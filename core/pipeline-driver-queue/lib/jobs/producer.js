const { Events } = require('@hkube/producer-consumer');
const producerSingleton = require('./producer-singleton');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, jobState, bullEvents, taskStatus } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const queueRunner = require('../queue-runner');
const Etcd = require('@hkube/etcd');

class JobProducer {
    constructor() {
        // in order to verify that the active is not some job that was in stalled before 
        this._lastSentJob = null;
        this._etcd = new Etcd();
    }

    async init(options) {
        const { etcd, serviceName } = options;
        await this._etcd.init({ etcd, serviceName });
        this._producer = producerSingleton.get;
        this.bullQueue = this._producer._createQueue(options.consumer.jobType);
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    // should handle cases where there is currently not any active job and new job added to queue 
    _checkWorkingStatusInterval() {
        setInterval(async () => {
            const waitingCount = await this.bullQueue.getWaitingCount();
            const activeCount = await this.bullQueue.getActiveCount();
            if (waitingCount === 0 && activeCount === 0 && queueRunner.queue.get.length > 0) {
                await this.createJob();
            }
        }, 1000);
    }

    getPendingAmount() {
        return this.bullQueue.getWaitingCount();
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobId}`, { component, jobId: data.jobId, status: jobState.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            log.info(`${Events.ACTIVE} ${data.jobId}`, { component, jobId: data.jobId, status: jobState.ACTIVE });
            // verify that not stalled job is the active one 
            if (data.jobId === this._lastSentJob) {
                await this.createJob();
            }
        });
        this._producer.on(Events.COMPLETED, (data) => {
            log.info(`${bullEvents.COMPLETED} ${data.jobId}`, { component, jobId: data.jobId, status: jobState.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            log.error(`${bullEvents.FAILED} ${data.jobId}, error: ${data.error}`, { component, jobId: data.jobId, status: jobState.FAILED });
        });
        this._producer.on(Events.STALLED, (data) => {
            log.error(`${bullEvents.STALLED} ${data.jobId}, error: ${data.error}`, { component, jobId: data.jobId, status: jobState.STALLED });
        });
        this._producer.on(Events.CRASHED, async ({ taskID, jobId }) => {
            // { jobId, taskId, result, status, error }
            await this._etcd.tasks.setState({ taskId: taskID, jobId, status: taskStatus.fail, error: 'crashLoop backoff' });
            log.error(`${Events.CRASHED} ${jobId}, `, { component, jobId: data.jobId, status: jobState.STALLED });
        });
    }

    _taskToProducerJob(pipeline) {
        return {
            job: {
                type: 'pipeline-driver-job',
                data: {
                    jobId: pipeline.jobId
                }
            },
            tracing: {
                tags: {
                    jobId: pipeline.jobId
                }
            }
        };
    }

    async createJob() {
        const pipeline = queueRunner.queue.tryPop();
        if (pipeline) {
            log.info(`pop new job ${pipeline.jobId}, calculated score: ${pipeline.calculated.score}`, { component });
            this._lastSentJob = pipeline.jobId;
            const job = this._taskToProducerJob(pipeline);
            return this._producer.createJob(job);
        }
        log.info('queue is empty', { component });
    }
}

module.exports = new JobProducer();
