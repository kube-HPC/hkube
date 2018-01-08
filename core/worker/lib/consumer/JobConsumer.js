const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const etcd = require('../states/discovery');
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const { metricsNames } = require('../../common/consts/metricsNames');
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._active = false;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
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
        log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`);
        this._consumer.on('job', async (job) => {
            log.info(`Job arrived with inputs: ${JSON.stringify(job.data.input)}`);
            metrics.get(metricsNames.algorithm_started).inc({
                labelValues: {
                    pipeline_name: job.data.pipeline_name,
                    algorithm_name: this._options.jobConsumer.job.type
                }
            });
            metrics.get(metricsNames.algorithm_net).start({
                id: job.data.taskID,
                labelValues: {
                    pipeline_name: job.data.pipeline_name,
                    algorithm_name: this._options.jobConsumer.job.type
                }
            });
            
            this._job = job;
            etcd.watch({ jobId: this._job.data.jobID });
            stateManager.setJob(job);
            stateManager.prepare(job);
            this.emit('job', job);
        });

        // this._unRegister();
        log.info('waiting for ready state');
        stateManager.once(stateEvents.stateEntered, () => {
            this._consumer.register(this._options.jobConsumer);
        });
    }
    _registerMetrics() {
        metrics.removeMeasure(metricsNames.algorithm_net);
        metrics.addTimeMeasure({
            name: metricsNames.algorithm_net,
            labels: ['pipeline_name', 'algorithm_name', 'status'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        });
        metrics.removeMeasure(metricsNames.algorithm_completed);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_completed,
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.algorithm_started);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_started,
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.algorithm_failed);
        metrics.addCounterMeasure({
            name: metricsNames.algorithm_failed,
            labels: ['pipeline_name', 'algorithm_name'],
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
    async finishJob(result) {
        if (!this._job) {
            return;
        }
        
        await etcd.unwatch({ jobId: this._job.data.jobID });
        let error = result && result.error;
        if (error && error.message) {
            error = error.message;
        }
        const status = error ? 'failed' : 'succeed';
        metrics.get(metricsNames.algorithm_completed).inc({
            labelValues: {
                pipeline_name: this._job.data.pipeline_name,
                algorithm_name: this._options.jobConsumer.job.type
            }
        });
        metrics.get(metricsNames.algorithm_net).start({
            id: this._job.data.taskID,
            labelValues: {
                status
            }
        });
        log.info(`status: ${status}, error: ${error}`);
        await etcd.update({
            jobId: this._job.data.jobID, taskId: this._job.id, status, result, error
        });
        this._job.done(error, result);
        this._job = null;
    }
}

module.exports = new JobConsumer();
