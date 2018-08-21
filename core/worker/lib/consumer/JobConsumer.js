const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const etcd = require('../states/discovery');
const { tracer, metrics, utils } = require('@hkube/metrics');
const { metricsNames } = require('../../common/consts/metricsNames');
const component = require('../../common/consts/componentNames').CONSUMER;
const datastoreHelper = require('../helpers/datastoreHelper');
const dataExtractor = require('./data-extractor');
const constants = require('./consts');
const { MetadataPlugin } = Logger;
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._storageAdapter = null;
        this._jobID = undefined;
        this._taskID = undefined;
        this._pipelineName = undefined;
        this._consumerPaused = false;
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
        this._storageAdapter = datastoreHelper.getAdapter();
        if (this._consumer) {
            this._consumer.removeAllListeners();
            this._consumer = null;
            this._job = null;
        }
        this._registerMetrics();
        this._consumer = new Consumer(this._options.jobConsumer);
        this._consumer.on('job', async (job) => {
            log.info(`Job arrived with inputs: ${JSON.stringify(job.data.input)}`, { component });
            metrics.get(metricsNames.algorithm_started).inc({
                labelValues: {
                    pipelineName: job.data.pipelineName,
                    algorithmName: this._options.jobConsumer.job.type
                }
            });
            metrics.get(metricsNames.algorithm_net).start({
                id: job.data.taskID,
                labelValues: {
                    pipelineName: job.data.pipelineName,
                    algorithmName: this._options.jobConsumer.job.type
                }
            });
            metrics.get(metricsNames.algorithm_runtime).start({
                id: job.data.taskID,
                labelValues: {
                    pipelineName: job.data.pipelineName,
                    algorithmName: this._options.jobConsumer.job.type
                }
            });

            this._job = job;
            this._jobID = job.data.jobID;
            this._taskID = job.data.taskID;
            this._pipelineName = job.data.pipelineName;
            this._jobData = { node: job.data.node, batchID: job.data.batchID };
            const watchState = await etcd.watch({ jobId: this._jobID });

            if (watchState && watchState.state === constants.WATCH_STATE.STOP) {
                this.finishJob();
                return;
            }
            await etcd.update({
                jobId: this._jobID, taskId: this._taskID, status: constants.JOB_STATUS.ACTIVE
            });

            stateManager.setJob(job);
            stateManager.prepare();
        });

        // this._unRegister();
        log.info('waiting for ready state', { component });
        stateManager.once(stateEvents.stateEntered, () => {
            log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`, { component });
            this._consumer.register(this._options.jobConsumer);
        });
    }

    pause() {
        log.info('Job consumer paused', { component });
        this._consumerPaused = true;
        return this._consumer.pause({ type: this._options.jobConsumer.job.type });
    }
    resume() {
        log.info('Job consumer resumed', { component });
        this._consumerPaused = false;
        return this._consumer.resume({ type: this._options.jobConsumer.job.type });
    }
    async updateDiscovery(data) {
        const discoveryInfo = this.getDiscoveryData(data);
        await etcd.updateDiscovery(discoveryInfo);
    }

    getDiscoveryData(data) {
        const { workerStatus, jobStatus, error } = this._getStatus(data);
        const discoveryInfo = {
            jobID: this._jobID,
            taskID: this._taskID,
            pipelineName: this._pipelineName,
            jobData: this._jobData,
            algorithmName: this._options.jobConsumer.job.type,
            podName: this._options.kubernetes.pod_name,
            workerStatus,
            jobStatus,
            workerPaused: this.isConsumerPaused,
            error
        };
        return discoveryInfo;
    }

    _registerMetrics() {
        metrics.removeMeasure(metricsNames.algorithm_net);
        metrics.addTimeMeasure({
            name: metricsNames.algorithm_net,
            labels: ['pipelineName', 'algorithmName', 'status'],
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
        metrics.removeMeasure(metricsNames.algorithm_completed);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_completed,
            labels: ['pipelineName', 'algorithmName'],
        });
        metrics.removeMeasure(metricsNames.algorithm_runtime);
        metrics.addSummary({
            name: metricsNames.algorithm_runtime,
            labels: ['pipelineName', 'algorithmName', 'status'],
            percentiles: [0.5]
        });
        metrics.removeMeasure(metricsNames.algorithm_started);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_started,
            labels: ['pipelineName', 'algorithmName'],
        });
        metrics.removeMeasure(metricsNames.algorithm_failed);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_failed,
            labels: ['pipelineName', 'algorithmName'],
        });
    }

    _register() {
        this._consumer.register(this._options.jobConsumer);
        // stateManager.once(stateEvents.stateEntered,({state})=>{
        //     this._unRegister();
        // })
    }

    _unRegister() {
        // this._consumer.unregister()
        stateManager.once(stateEvents.stateEntered, () => {
            this._register();
        });
    }

    _getStatus(data) {
        const { state, results } = data;
        const workerStatus = state;
        let jobStatus = state === constants.JOB_STATUS.WORKING ? constants.JOB_STATUS.ACTIVE : state;
        let error = null;

        if (results != null) {
            error = results.error && results.error.message;
            jobStatus = error ? constants.JOB_STATUS.FAILED : constants.JOB_STATUS.SUCCEED;
        }

        const resultData = results && results.data;
        return {
            workerStatus,
            jobStatus,
            error,
            resultData
        };
    }

    async extractData(jobInfo) {
        const span = tracer.startSpan({
            name: 'storage-get',
            id: this._taskID,
            tags: {
                jobID: this._jobID,
                taskID: this._taskID,
            }
        });
        const { error, data } = await this._tryExtractDataFromStorage(jobInfo);
        if (error) {
            log.error(`failed to extract data input: ${error.message}`, { component }, error);
            stateManager.done({ error });
        }
        if (span) {
            span.finish(error);
        }
        return { error, data };
    }

    async _tryExtractDataFromStorage(jobInfo) {
        try {
            const input = await dataExtractor.extract(jobInfo.input, jobInfo.storage, this._storageAdapter);
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

        await etcd.unwatch({ jobId: this._jobID });
        let resultLink = null;
        let { resultData, jobStatus, error } = this._getStatus(data); // eslint-disable-line prefer-const

        if (!error && jobStatus === constants.JOB_STATUS.SUCCEED) {
            const { storageError, storageLink } = await this._putResult(resultData);
            if (storageError) {
                jobStatus = constants.JOB_STATUS.FAILED;
                error = storageError;
            }
            resultLink = storageLink;
        }

        await etcd.update({
            jobId: this._jobID, taskId: this._taskID, status: jobStatus, result: resultLink, error
        });

        metrics.get(metricsNames.algorithm_completed).inc({
            labelValues: {
                pipelineName: this._pipelineName,
                algorithmName: this._options.jobConsumer.job.type
            }
        });
        metrics.get(metricsNames.algorithm_net).end({
            id: this._taskID,
            labelValues: {
                status: jobStatus
            }
        });
        metrics.get(metricsNames.algorithm_runtime).end({
            id: this._taskID,
            labelValues: {
                status: jobStatus
            }
        });
        log.debug(`result: ${JSON.stringify(resultLink)}`, { component });
        log.debug(`status: ${jobStatus}, error: ${error}`, { component });

        this._job.done(error);
        this._job = null;
        this._jobID = undefined;
        this._taskID = undefined;
        this._pipelineName = undefined;
        this._jobData = undefined;
    }

    async _putResult(data) {
        let storageLink = null;
        let storageError = null;
        let span;
        try {
            span = tracer.startSpan({
                name: 'storage-put',
                id: this._taskID,
                tags: {
                    jobID: this._jobID,
                    taskID: this._taskID,
                }
            });
            if (data === undefined) {
                data = null;
            }
            const storageInfo = await this._storageAdapter.put({
                jobId: this._job.data.jobID, taskId: this._job.data.taskID, data
            });
            const object = { [this._job.data.node]: data };
            storageLink = {
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
            log.error(`failed to store data job:${this._jobID} task:${this._taskID}`, { component }, err);
            storageError = err.message;
        }
        return {
            storageLink,
            storageError
        };
    }

    currentTaskInfo() {
        return {
            jobId: this._jobID,
            taskId: this._taskID,
            pipelineName: this._pipelineName,
            algorithmName: this._options.jobConsumer.job.type
        };
    }

    get isConsumerPaused() {
        return this._consumerPaused;
    }

    get jobId() {
        return this._jobID;
    }

    get taskId() {
        return this._taskID;
    }
}

module.exports = new JobConsumer();
