const { Events } = require('@hkube/producer-consumer');
const producerSingleton = require('./producer-singleton');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, jobState, taskStatus } = require('../consts/index');
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
        this.bullQueue = this._producer._createQueue(options.algorithmType);
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    // should handle cases where there is currently not any active job and new job added to queue 
    _checkWorkingStatusInterval() {
        setInterval(async () => {
            const waitingCount = await this.bullQueue.getWaitingCount();
            if (waitingCount === 0 && queueRunner.queue.get.length > 0) {
                await this.createJob();
            }
        }, 1000);
    }

    getPendingAmount() {
        return this.bullQueue.getWaitingCount();
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            log.info(`${Events.ACTIVE} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.ACTIVE });
            // verify that not stalled job is the active one 
            if (data.jobId === this._lastSentJob) {
                await this.createJob();
            }
        });
        this._producer.on(Events.COMPLETED, (data) => {
            log.debug(`${Events.COMPLETED} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            log.error(`${Events.FAILED} ${data.jobId}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.FAILED });
        });
        this._producer.on(Events.STALLED, (data) => {
            log.error(`${Events.STALLED} ${data.jobId}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.STALLED });
        });
        this._producer.on(Events.CRASHED, async (job) => {
            const { jobId, taskId } = job.options;
            const { error } = job;
            const status = taskStatus.CRASHED;
            log.error(`${error} ${taskId}`, { component: componentName.JOBS_PRODUCER, jobId, status });
            await this._etcd.tasks.setState({ jobId, taskId, status, error });
        });
    }

    _taskToProducerJob(task) {
        const { calculated, initialBatchLength, spanId, ...taskData } = task;
        return {
            job: {
                id: task.taskId,
                type: task.algorithmName,
                data: taskData
            },
            tracing: {
                parent: spanId,
                tags: {
                    jobId: task.jobId,
                    taskId: task.taskId
                }
            }
        };
    }

    async createJob() {
        const task = queueRunner.queue.tryPop();
        if (task) {
            log.info(`pop new task with taskId: ${task.taskId}`, { component: componentName.JOBS_PRODUCER });
            log.info(`calculated score: ${task.calculated.score}`, { component: componentName.JOBS_PRODUCER });
            this._lastSentJob = task.taskId;
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }
        log.info('queue is empty ', { component: componentName.JOBS_PRODUCER });
    }
}

module.exports = new JobProducer();
