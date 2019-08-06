const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const { tracer } = require('@hkube/metrics');
const { Consumer } = require('@hkube/producer-consumer');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const etcd = require('../states/discovery');
const { Components } = require('../consts');
const dataExtractor = require('./data-extractor');
const constants = require('./consts');

const metrics = require('../metrics/metrics');
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
        this._options.jobConsumer.setting.tracer = tracer;
        this._jobType = this._options.jobConsumer.job.type;
        // create another tracer for the algorithm
        this._algTracer = await tracer.createTracer(this.getAlgorithmType(), options.tracer);

        if (this._consumer) {
            this._consumer.removeAllListeners();
            stateManager.removeAllListeners('job-ready');
            this._consumer = null;
            this._job = null;
        }
        this._hotWorker = this._options.hotWorker;
        this._consumer = new Consumer(this._options.jobConsumer);
        this._consumer.register(this._options.jobConsumer);
        log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`, { component });

        this._consumer.on('job', async (job) => {
            log.info(`queue job ${job.data.jobId}`, { component });
            if (job.data.nodeType === 'Preschedule') {
                log.info(`job ${job.data.jobId} is in ${job.data.nodeType} mode, calling done...`);
                job.done();
                return;
            }
            log.info(`execute job ${job.data.jobId} with inputs: ${JSON.stringify(job.data.input)}`, { component });
            const watchState = await etcd.watch({ jobId: job.data.jobId });
            if (watchState && watchState.state === constants.WATCH_STATE.STOP) {
                await this._stopJob(job);
                return;
            }

            this._initMetrics(job);

            this._job = job;
            this._jobId = job.data.jobId;
            this._taskId = job.data.taskId;
            this._execId = job.data.execId;
            this._batchIndex = job.data.batchIndex;
            this._pipelineName = job.data.pipelineName;
            this._jobData = { nodeName: job.data.nodeName, batchIndex: job.data.batchIndex };

            metrics.initMetrics(job, this._jobType);

            if (this._execId) {
                const watchExecutionState = await etcd.watchAlgorithmExecutions({ jobId: this._jobId, taskId: this._taskId });
                if (watchExecutionState && watchExecutionState.state === constants.WATCH_STATE.STOP) {
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
                startTime: Date.now()
            });

            stateManager.setJob(job);
            stateManager.jobQueued = true;
        });
        stateManager.on('job-ready', (job) => {
            log.info(`execute job ${job.data.jobId} with inputs: ${JSON.stringify(job.data.input)}`, { component });
            stateManager.jobQueued = false;
            stateManager.prepare();
        });
        stateManager.on('finish', () => {
            if (this._job) {
                this._job.done(this._job.error);
                log.info(`finish job ${this._jobId}`, { component });
            }
            this._job = null;
            this._jobId = undefined;
            this._taskId = undefined;
            this._pipelineName = undefined;
            this._jobData = undefined;
        });
    }

    async _stopJob(job) {
        await etcd.unwatch({ jobId: job.data.jobId });
        log.info(`job ${job.data.jobId} already stopped!`);
        job.done();
    }

    async pause() {
        try {
            this._consumerPaused = true;
            await this._consumer.pause({ type: this._jobType });
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
            await this._consumer.resume({ type: this._jobType });
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

    _getStatus(data) {
        const { state, results } = data;
        const workerStatus = state;
        let status = state === constants.JOB_STATUS.WORKING ? constants.JOB_STATUS.ACTIVE : state;
        let error = null;
        let reason = null;

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

    async finishJob(data = {}) {
        if (!this._job) {
            return;
        }
        await etcd.unwatch({ jobId: this._jobId });
        if (this._execId) {
            await etcd.unwatchAlgorithmExecutions({ jobId: this._jobId, taskId: this._taskId });
        }
        let storageResult = {};
        const { resultData, status, error, reason } = this._getStatus(data);

        if (!error && status === constants.JOB_STATUS.SUCCEED) {
            storageResult = await this._putResult(resultData);
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
            endTime: Date.now()
        }, storageResult);

        this._job.error = error;
        await etcd.update(resData);
        await this._putMetadata(resData);
        this._summarizeMetrics();
        log.debug(`result: ${JSON.stringify(resData.result)}`, { component });
        log.info(`finishJob - status: ${status}, error: ${error}`, { component });
    }

    _summarizeMetrics(status) {
        try {
            metrics.summarizeMetrics(status, this._pipelineName, this.getAlgorithmType(), this._jobId, this._taskId);
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
        return this._jobType;
    }

    get algTracer() {
        return this._algTracer;
    }
}

module.exports = new JobConsumer();
