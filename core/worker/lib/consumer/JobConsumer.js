const EventEmitter = require('events');
const recursive = require('recursive-readdir');
const { parser } = require('@hkube/parsers');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer, metrics, utils } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const fse = require('fs-extra');
const pathLib = require('path');
const stateManager = require('../states/stateManager');
const etcd = require('../states/discovery');
const { metricsNames, Components, JobStatus } = require('../consts');
const dataExtractor = require('./data-extractor');
const constants = require('./consts');
const JobProvider = require('./job-provider');
const pipelineDoneStatus = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.STOPPED];
const { MetadataPlugin } = Logger;
const component = Components.CONSUMER;
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._jobId = undefined;
        this._taskId = undefined;
        this._batchIndex = undefined;
        this._pipelineName = undefined;
        this._consumerPaused = false;
        this.workerStartingTime = new Date();
        this.jobCurrentTime = null;
        this._hotWorker = false;
        this._algTracer = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        log.metadataEnrichers.use(new MetadataPlugin({
            enrichCallback: metadata => ({
                ...metadata, ...this.currentTaskInfo()
            })
        }));
        const { algoMetricsDir } = options;
        this._algoMetricsDir = algoMetricsDir;
        this._options = Object.assign({}, options);
        this._options.jobConsumer.setting.redis = options.redis;
        this._options.jobConsumer.setting.tracer = tracer;
        // create another tracer for the algorithm
        this._algTracer = await tracer.createTracer(this.getAlgorithmType(), options.tracer);

        if (this._consumer) {
            this._consumer.removeAllListeners();
            this._consumer = null;
            this._job = null;
        }
        this._hotWorker = this._options.hotWorker;
        this._registerMetrics();
        this._consumer = new Consumer(this._options.jobConsumer);
        this._jobProvider = new JobProvider(options);
        this._jobProvider.init(this._consumer);
        this._consumer.register(this._options.jobConsumer);
        log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`, { component });

        this._jobProvider.on('job', async (job) => {
            if (job.data.status === JobStatus.PRESCHEDULE) {
                log.info(`job ${job.data.jobId} is in ${job.data.status} mode, calling done...`);
                job.done();
                return;
            }
            log.info(`execute job ${job.data.jobId} with inputs: ${JSON.stringify(job.data.input)}`, { component });
            const watchState = await etcd.watch({ jobId: job.data.jobId });
            if (watchState && this._isCompletedState({ status: watchState.status })) {
                await this._stopJob(job, watchState.status);
                return;
            }

            this._initMetrics(job);
            this._setJob(job);

            if (this._execId) {
                const watchExecutionState = await etcd.watchAlgorithmExecutions({ jobId: this._jobId, taskId: this._taskId });
                if (watchExecutionState && watchExecutionState.status === constants.WATCH_STATE.STOPPED) {
                    await this.finishJob();
                    return;
                }
            }

            await etcd.update({
                jobId: this._jobId,
                taskId: this._taskId,
                status: constants.JOB_STATUS.ACTIVE,
                execId: this._job.data.execId,
                nodeName: this._job.data.nodeName,
                algorithmName: this._job.data.algorithmName,
                podName: this._options.kubernetes.pod_name,
                startTime: Date.now()
            });

            stateManager.setJob(job);
            stateManager.prepare();
        });

        this._jobProvider.on('job-queue', async (job) => {
            this._setJob(job);
        });

        stateManager.on('finish', () => {
            this.finishBullJob();
        });
    }

    _isCompletedState({ status }) {
        return pipelineDoneStatus.includes(status);
    }

    _shouldNormalExit(options) {
        const { shouldCompleteJob } = options || {};
        return shouldCompleteJob === undefined ? true : shouldCompleteJob;
    }

    finishBullJob(options) {
        const shouldCompleteJob = this._shouldNormalExit(options);
        if (this._job && shouldCompleteJob) {
            this._job.done(this._job.error);
            log.info(`finish job ${this._jobId}`);
        }
        this._job = null;
        this._jobId = undefined;
        this._taskId = undefined;
        this._pipelineName = undefined;
        this._jobData = undefined;
    }

    _setJob(job) {
        this._job = job;
        this._jobId = job.data.jobId;
        this._taskId = job.data.taskId;
        this._execId = job.data.execId;
        this._batchIndex = job.data.batchIndex;
        this._pipelineName = job.data.pipelineName;
        this._jobData = { nodeName: job.data.nodeName, batchIndex: job.data.batchIndex };
    }

    async _stopJob(job, status) {
        await etcd.unwatch({ jobId: job.data.jobId });
        log.info(`job ${job.data.jobId} already in ${status} status`);
        job.done();
    }

    _initMetrics(job) {
        const { pipelineName } = job.data;
        metrics.get(metricsNames.worker_started).inc({
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: this._options.jobConsumer.job.type
            }
        });
        metrics.get(metricsNames.worker_net).start({
            id: job.data.taskId,
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: this._options.jobConsumer.job.type
            }
        });
        metrics.get(metricsNames.worker_runtime).start({
            id: job.data.taskId,
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: this._options.jobConsumer.job.type
            }
        });
    }

    async pause() {
        try {
            this._consumerPaused = true;
            await this._consumer.pause({ type: this._options.jobConsumer.job.type });
            log.info('Job consumer paused', { component });
        }
        catch (err) {
            this._consumerPaused = false;
            log.error(`Failed to pause consumer. Error:${err.message}`, { component });
        }
    }

    async resume() {
        try {
            this._consumerPaused = false;
            await this._consumer.resume({ type: this._options.jobConsumer.job.type });
            log.info('Job consumer resumed', { component });
        }
        catch (err) {
            this._consumerPaused = true;
            log.error(`Failed to resume consumer. Error:${err.message}`, { component });
        }
    }

    get hotWorker() {
        return this._hotWorker;
    }

    set hotWorker(value) {
        this._hotWorker = value;
    }

    async updateDiscovery(data) {
        const discoveryInfo = this.getDiscoveryData(data);
        await etcd.updateDiscovery(discoveryInfo);
    }

    getDiscoveryData(data) {
        const {
            workerStatus, jobStatus, error
        } = this._getStatus(data);
        const discoveryInfo = {
            jobId: this._jobId,
            taskId: this._taskId,
            pipelineName: this._pipelineName,
            jobData: this._jobData,
            workerStatus,
            jobStatus,
            workerStartingTime: this.workerStartingTime,
            jobCurrentTime: this.jobCurrentTime,
            workerPaused: this.isConsumerPaused,
            hotWorker: this._hotWorker,
            error
        };
        return discoveryInfo;
    }

    _registerMetrics() {
        metrics.removeMeasure(metricsNames.worker_net);
        metrics.addTimeMeasure({
            name: metricsNames.worker_net,
            labels: ['pipeline_name', 'algorithm_name', 'status'],
            description: 'Algorithm runtime histogram',
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
        metrics.removeMeasure(metricsNames.worker_succeeded);
        metrics.addCounterMeasure({
            name: metricsNames.worker_succeeded,
            description: 'Number of times the algorithm has completed',
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.worker_runtime);
        metrics.addSummary({
            name: metricsNames.worker_runtime,
            description: 'Algorithm runtime summary',
            labels: ['pipeline_name', 'algorithm_name', 'status'],
            percentiles: [0.5]
        });
        metrics.removeMeasure(metricsNames.worker_started);
        metrics.addCounterMeasure({
            name: metricsNames.worker_started,
            description: 'Number of times the algorithm has started',
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.worker_failed);
        metrics.addCounterMeasure({
            name: metricsNames.worker_failed,
            description: 'Number of times the algorithm has failed',
            labels: ['pipeline_name', 'algorithm_name'],
        });
    }

    _getStatus(data) {
        const { state, results } = data;
        const workerStatus = state;
        let status = state === constants.JOB_STATUS.WORKING ? constants.JOB_STATUS.ACTIVE : state;
        let error = null;
        let reason = null;
        const shouldCompleteJob = this._shouldNormalExit(results);

        if (results != null) {
            error = results.error && results.error.message;
            reason = results.error && results.error.reason;
            status = error ? constants.JOB_STATUS.FAILED : constants.JOB_STATUS.SUCCEED;
        }

        const resultData = results && results.data;
        return {
            workerStatus,
            status,
            error,
            reason,
            resultData,
            shouldCompleteJob
        };
    }

    async extractData(jobInfo) {
        this.jobCurrentTime = new Date();
        const { error, data } = await this._tryExtractDataFromStorage(jobInfo);
        if (error) {
            log.error(`failed to extract data input: ${error.message}`, { component }, error);
            stateManager.done({ error });
        }
        return { error, data };
    }

    async _tryExtractDataFromStorage(jobInfo) {
        function partial(func, argsBound) {
            return (args) => {
                return func.call(tracer, { ...argsBound, tags: { ...argsBound.tags, ...args } });
            };
        }
        try {
            const input = await dataExtractor.extract(jobInfo.input, jobInfo.storage, partial(tracer.startSpan, this.getTracer('storage-get')));
            return { data: { ...jobInfo, input } };
        }
        catch (error) {
            return { error };
        }
    }

    async sendWarning(warning) {
        if (!this._jobId) {
            return;
        }
        const data = {
            warning,
            status: constants.JOB_STATUS.WARNING,
            jobId: this._jobId,
            taskId: this._taskId,
            execId: this._job.data.execId,
            nodeName: this._job.data.nodeName,
            algorithmName: this._job.data.algorithmName,
        };
        await etcd.update(data);
    }

    async finishJob(data = {}) {
        if (!this._job) {
            return;
        }
        await etcd.unwatch({ jobId: this._jobId });
        if (this._execId) {
            await etcd.unwatchAlgorithmExecutions({ jobId: this._jobId, taskId: this._taskId });
        }
        let storageResult = {};
        const { resultData, status, error, reason, shouldCompleteJob } = this._getStatus(data);

        if (shouldCompleteJob) {
            let metricsPath;
            if (!error && status === constants.JOB_STATUS.SUCCEED) {
                storageResult = await this._putResult(resultData);
                if (this.jobData.metrics && this.jobData.metrics.tensorboard) {
                    const tensorboard = await this._putAlgoMetrics();
                    metricsPath = { tensorboard };
                }
            }
            const resData = Object.assign({
                status,
                error,
                reason,
                jobId: this._jobId,
                taskId: this._taskId,
                execId: this._job.data.execId,
                nodeName: this._job.data.nodeName,
                algorithmName: this._job.data.algorithmName,
                batchIndex: this._batchIndex,
                endTime: Date.now(),
                metricsPath
            }, storageResult);

            this._job.error = error;
            await etcd.update(resData);
            await this._putMetadata(resData);
            log.debug(`result: ${JSON.stringify(resData.result)}`, { component });
        }
        this._summarizeMetrics(status);
        log.info(`finishJob - status: ${status}, error: ${error}`, { component });
    }

    _summarizeMetrics(jobStatus) {
        try {
            if (jobStatus === constants.JOB_STATUS.FAILED) {
                metrics.get(metricsNames.worker_failed).inc({
                    labelValues: {
                        pipeline_name: this._pipelineName,
                        algorithm_name: this.getAlgorithmType()
                    }
                });
            }
            else if (jobStatus === constants.JOB_STATUS.SUCCEED) {
                metrics.get(metricsNames.worker_succeeded).inc({
                    labelValues: {
                        pipeline_name: this._pipelineName,
                        algorithm_name: this.getAlgorithmType()
                    }
                });
            }
            metrics.get(metricsNames.worker_net).end({
                id: this._taskId,
                labelValues: {
                    status: jobStatus
                }
            });
            metrics.get(metricsNames.worker_runtime).end({
                id: this._taskId,
                labelValues: {
                    status: jobStatus
                }
            });
        }
        catch (err) {
            log.warning(`failed to report metrics:${this._jobId} task:${this._taskId}`, { component }, err);
        }
    }

    async _putMetadata(metadata) {
        try {
            await storageManager.hkubeMetadata.put({ jobId: this._jobId, taskId: this._taskId, data: metadata });
        }
        catch (err) {
            log.error(`failed to store Metadata job:${this._jobId} task:${this._taskId}, ${err}`, { component }, err);
        }
    }

    async _putResult(data) {
        let result = null;
        let error;
        let status = constants.JOB_STATUS.SUCCEED;
        try {
            if (data === undefined) {
                // eslint-disable-next-line no-param-reassign
                data = null;
            }
            const storageInfo = await storageManager.hkube.put({
                jobId: this._job.data.jobId, taskId: this._job.data.taskId, data
            }, tracer.startSpan.bind(tracer, this.getTracer('storage-put')));

            const object = { [this._job.data.nodeName]: data };
            result = {
                metadata: parser.objectToMetadata(object, this._job.data.info.savePaths),
                storageInfo
            };
        }
        catch (err) {
            log.error(`failed to store data job:${this._jobId} task:${this._taskId}, ${err}`, { component }, err);
            error = err.message;
            status = constants.JOB_STATUS.FAILED;
        }
        finally {
            // eslint-disable-next-line no-unsafe-finally
            return {
                status,
                result,
                error
            };
        }
    }

    async _putAlgoMetrics() {
        let path = null;
        let error;
        try {
            const formatedDate = this.jobCurrentTime.toLocaleString().split('/').join('-');
            const files = await recursive(this._algoMetricsDir);
            const { taskId, jobId } = this.jobData;
            const paths = await Promise.all(files.map((file) => {
                const stream = fse.createReadStream(file);
                const fileName = file.replace(this._algoMetricsDir, '');
                return storageManager.hkubeAlgoMetrics.putStream(
                    { pipelineName: this.jobData.pipelineName, taskId, jobId, nodeName: this.jobData.nodeName, data: stream, formatedDate, fileName, stream }
                );
            }));
            const separatedPath = paths[0] && paths[0].path.split(pathLib.sep);
            path = separatedPath && separatedPath.slice(0, separatedPath.length - 1).join(pathLib.sep);
        }
        catch (err) {
            error = err.message;
        }
        finally {
            // eslint-disable-next-line no-unsafe-finally
            return {
                path,
                error
            };
        }
    }

    getTracer(name) {
        let parent = null;
        const topWorkerSpan = tracer.topSpan(this._taskId);
        if (topWorkerSpan) {
            parent = topWorkerSpan.context();
        }
        return {
            name,
            id: this._taskId,
            parent,
            tags: {
                jobId: this._jobId,
                taskId: this._taskId
            }
        };
    }

    currentTaskInfo() {
        return {
            jobId: this._jobId,
            taskId: this._taskId,
            pipelineName: this._pipelineName,
            algorithmName: this.getAlgorithmType(),
            batchIndex: this._batchIndex
        };
    }

    get isConsumerPaused() {
        return this._consumerPaused;
    }

    get jobData() {
        return this._job && this._job.data;
    }

    get jobId() {
        return this._jobId;
    }

    get taskId() {
        return this._taskId;
    }

    getAlgorithmType() {
        return this._options.jobConsumer.job.type;
    }

    get algTracer() {
        return this._algTracer;
    }
}

module.exports = new JobConsumer();
