const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer, metrics, utils } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const etcd = require('../states/discovery');
const { metricsNames, Components } = require('../consts');
const dataExtractor = require('./data-extractor');
const constants = require('./consts');
const JobProvider = require('./job-provider');
const formatter = require('../helpers/formatters');

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
            log.info(`execute job ${job.data.jobId} with inputs: ${JSON.stringify(job.data.input)}`, { component });
            this._initMetrics(job);
            this._job = job;
            this._jobId = job.data.jobId;
            this._taskId = job.data.taskId;
            this._batchIndex = job.data.batchIndex;
            this._pipelineName = job.data.pipelineName;
            this._jobData = { nodeName: job.data.nodeName, batchIndex: job.data.batchIndex };
            const watchState = await etcd.watch({ jobId: this._jobId });

            if (watchState && watchState.state === constants.WATCH_STATE.STOP) {
                await this.finishJob();
                return;
            }
            await etcd.update({
                jobId: this._jobId, taskId: this._taskId, status: constants.JOB_STATUS.ACTIVE
            });

            stateManager.setJob(job);
            stateManager.prepare();
        });
    }

    _initMetrics(job) {
        const pipelineName = formatter.formatPipelineName(job.data.pipelineName);
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
            algorithmName: this.getAlgorithmType(),
            podName: this._options.kubernetes.pod_name,
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

        if (results != null) {
            error = results.error && results.error.message;
            status = error ? constants.JOB_STATUS.FAILED : constants.JOB_STATUS.SUCCEED;
        }

        const resultData = results && results.data;
        return {
            workerStatus,
            status,
            error,
            resultData
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
        const startSpan = tracer.startSpan.bind(tracer, {
            name: 'storage-get',
            id: this._taskId,
            tags: {
                jobId: this._jobId,
                taskId: this._taskId,
            }
        });
        try {
            const input = await dataExtractor.extract(jobInfo.input, jobInfo.storage, startSpan);
            return { data: { ...jobInfo, input } };
        }
        catch (error) {
            const span = tracer.pop(this._taskId);
            if (span) {
                span.finish(error);
            }
            return { error };
        }
    }


    async finishJob(data = {}) {
        if (!this._job) {
            return;
        }
        await etcd.unwatch({ jobId: this._jobId });
        let storageResult = {};
        let { resultData, status, error } = this._getStatus(data); // eslint-disable-line prefer-const

        if (!error && status === constants.JOB_STATUS.SUCCEED) {
            storageResult = await this._putResult(resultData);
        }

        const resData = Object.assign({ status, error, jobId: this._jobId, taskId: this._taskId }, storageResult);
        await etcd.update(resData);
        await this._putMetadata(resData);
        this._summarizeMetrics(status);
        log.debug(`result: ${JSON.stringify(resData.result)}`, { component });
        log.info(`finishJob - status: ${status}, error: ${error}`, { component });

        this._job.done(error);
        this._job = null;
        this._jobId = undefined;
        this._taskId = undefined;
        this._pipelineName = undefined;
        this._jobData = undefined;
    }

    _summarizeMetrics(jobStatus) {
        try {
            const pipelineName = formatter.formatPipelineName(this._pipelineName);
            if (jobStatus === constants.JOB_STATUS.FAILED) {
                metrics.get(metricsNames.worker_failed).inc({
                    labelValues: {
                        pipeline_name: pipelineName,
                        algorithm_name: this.getAlgorithmType()
                    }
                });
            }
            else if (jobStatus === constants.JOB_STATUS.SUCCEED) {
                metrics.get(metricsNames.worker_succeeded).inc({
                    labelValues: {
                        pipeline_name: pipelineName,
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
            log.error(`failed to report metrics:${this._jobId} task:${this._taskId}`, { component }, err);
        }
    }

    async _putMetadata(metadata) {
        try {
            await storageManager.hkubeMetadata.put({ jobId: this._jobId, taskId: this._taskId, data: metadata });
        }
        catch (err) {
            log.error(`failed to store Metadata job:${this._jobId} task:${this._taskId}`, { component }, err);
        }
    }

    async _putResult(data) {
        let result = null;
        let error = null;
        let status = constants.JOB_STATUS.SUCCEED;
        let span;
        try {
            span = tracer.startSpan({
                name: 'storage-put',
                id: this._taskId,
                tags: {
                    jobId: this._jobId,
                    taskId: this._taskId,
                }
            });
            if (data === undefined) {
                // eslint-disable-next-line no-param-reassign
                data = null;
            }
            const storageInfo = await storageManager.hkube.put({
                jobId: this._job.data.jobId, taskId: this._job.data.taskId, data
            });
            const object = { [this._job.data.nodeName]: data };
            result = {
                metadata: parser.objectToMetadata(object, this._job.data.info.savePaths),
                storageInfo
            };
            if (span) {
                span.finish();
            }
        }
        catch (err) {
            if (span) {
                span.finish(err);
            }
            log.error(`failed to store data job:${this._jobId} task:${this._taskId}`, { component }, err);
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
