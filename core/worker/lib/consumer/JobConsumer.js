const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const etcd = require('../states/discovery');
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const { metricsNames } = require('../../common/consts/metricsNames');
const component = require('../../common/consts/componentNames').CONSUMER;
const { MetadataPlugin } = Logger;
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._jobID = undefined;
        this._taskID = undefined;
        this._pipelineName = undefined;
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

            this._job = job;
            this._jobID = job.data.jobID;
            this._taskID = job.data.taskID;
            this._pipelineName = job.data.pipelineName;
            this._jobData = { node: job.data.node, batchID: job.data.batchID };
            const watchState = await etcd.watch({ jobId: this._jobID });

            if (watchState && watchState.state === 'stop') {
                this.finishJob();
                return;
            }
            await etcd.update({
                jobId: this._jobID, taskId: this._taskID, status: 'active'
            });

            stateManager.setJob(job);
            stateManager.prepare();
            this.emit('job', job);
        });

        // this._unRegister();
        log.info('waiting for ready state', { component });
        stateManager.once(stateEvents.stateEntered, () => {
            log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`, { component });
            this._consumer.register(this._options.jobConsumer);
        });
    }

    async updateDiscovery(data) {
        const { workerStatus, jobStatus, error } = this._getStatus(data);
        await etcd.updateDiscovery({
            jobID: this._jobID,
            taskID: this._taskID,
            pipelineName: this._pipelineName,
            jobData: this._jobData,
            algorithmName: this._options.jobConsumer.job.type,
            podName: this._options.k8s.pod_name,
            workerStatus,
            jobStatus,
            error
        });
    }

    _registerMetrics() {
        metrics.removeMeasure(metricsNames.algorithm_net);
        metrics.addTimeMeasure({
            name: metricsNames.algorithm_net,
            labels: ['pipelineName', 'algorithmName', 'status'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        });
        metrics.removeMeasure(metricsNames.algorithm_completed);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_completed,
            labels: ['pipelineName', 'algorithmName'],
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
        let jobStatus = state === 'working' ? 'active' : state;
        let error = null;

        if (results != null) {
            error = results.error && results.error.message;
            jobStatus = error ? 'failed' : 'succeed';
        }

        return {
            workerStatus,
            jobStatus,
            error,
            results
        };
    }

    async finishJob(data = {}) {
        if (!this._job) {
            return;
        }

        await etcd.unwatch({ jobId: this._jobID });

        const { jobStatus, results, error } = this._getStatus(data);
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
        log.debug(`result: ${JSON.stringify(results)}`, { component });
        log.debug(`status: ${jobStatus}, error: ${error}`, { component });
        const resultData = results && results.data;
        await etcd.update({
            jobId: this._jobID, taskId: this._taskID, status: jobStatus, result: resultData, error
        });

        this._job.done(error);
        this._job = null;
        this._jobID = undefined;
        this._taskID = undefined;
        this._pipelineName = undefined;
        this._jobData = undefined;
    }

    currentTaskInfo() {
        return {
            jobId: this._jobID,
            taskId: this._taskID,
            pipelineName: this._pipelineName,
            algorithmName: this._options.jobConsumer.job.type
        };
    }
}

module.exports = new JobConsumer();
