const { Events } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { uuid: uuidv4 } = require('@hkube/uid');
const { tracer } = require('@hkube/metrics');
const { Producer } = require('@hkube/producer-consumer');
const component = require('../consts/component-name').JOBS_PRODUCER;
const { isCompletedState } = require('../utils/pipelineStatuses');
const taskAdapter = require('../tasks-adapter');
const db = require('../persistency/db');
const MAX_JOB_ATTEMPTS = 3;

class JobProducer {
    constructor(config) {
        const { options, algorithmName } = config;
        this._algorithmName = algorithmName;
        this._getQueue = config.getQueue;
        this._addQueue = config.addQueue;
        this._tryPop = config.tryPop;
        this._producerUpdateInterval = options.producerUpdateInterval;
        this._producer = new Producer({
            setting: {
                redis: options.redis,
                tracer,
                ...options.producer
            }
        });
        this._producerQueue = this._producer._createQueue(algorithmName);
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    async stop() {
        await this._producer?.close({ type: this._algorithmName });
        clearInterval(this._interval);
        this._interval = null;
        this._producer = null;
    }

    async getWaitingCount() {
        return this._producerQueue.getWaitingCount();
    }

    async getWaitingJobs() {
        return this._producerQueue.getWaiting();
    }

    // should handle cases where there is currently not any active job and new job added to queue
    _checkWorkingStatusInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(async () => {
            if (this._isIntervalActive) {
                return;
            }
            try {
                this._isIntervalActive = true;
                if (this._getQueue().length > 0) {
                    const waitingCount = await this.getWaitingCount();
                    if (waitingCount === 0) {
                        await this.createJob();
                    }
                }
            }
            catch (e) {
                log.throttle.error(`fail on producer interval ${e}`, { component }, e);
            }
            finally {
                this._isIntervalActive = false;
            }
        }, this._producerUpdateInterval);
    }

    _getJobTaskId(data) {
        const jobId = data?.options?.data?.jobId;
        const taskId = data?.options?.data?.taskId;
        return { jobId, taskId };
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            const { jobId, taskId } = this._getJobTaskId(data);
            log.info(`${Events.WAITING} ${jobId}, ${taskId}`, { component, jobId, taskId, status: Events.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            const { jobId, taskId } = this._getJobTaskId(data);
            log.info(`${Events.ACTIVE} ${jobId}, ${taskId}`, { component, jobId, taskId, status: Events.ACTIVE });
            await this.createJob();
        });
        this._producer.on(Events.COMPLETED, (data) => {
            const { jobId, taskId } = this._getJobTaskId(data);
            log.debug(`${Events.COMPLETED} ${jobId}, ${taskId}`, { component, jobId, taskId, status: Events.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            const { jobId, taskId } = this._getJobTaskId(data);
            log.info(`${Events.FAILED} ${jobId}, ${taskId}`, { component, jobId, taskId, status: Events.FAILED });
        });
        this._producer.on(Events.STUCK, async (job) => {
            const { jobId, taskId } = job.options;
            const data = await db.getJobStatus({ jobId });
            log.info(`job ${jobId}, ${taskId}, stalled with ${data?.status} status`, { component });
            if (data) {
                log.info(`job stalled with ${data.status} status`, { component });
                if (isCompletedState({ status: data.status })) {
                    log.info(`completed job stalled with ${data.status} status. Skipping`, { component });
                    return;
                }
                if (data.status === taskStatuses.PRESCHEDULE) {
                    log.info(`job stalled with ${data.status} status. Skipping`, { component });
                    return;
                }
            }
            let err;
            let status;
            const task = await db.getTask({ jobId, taskId });
            if (!task) {
                log.error(`unable to find task ${taskId}`, { component });
                return;
            }
            const maxAttempts = task.retry?.limit ?? MAX_JOB_ATTEMPTS;
            const tasks = [taskAdapter.adaptData({ task, length: 1 })];
            let retries = task.attempts;

            if (retries > maxAttempts) {
                retries = maxAttempts;
                err = 'CrashLoopBackOff';
                status = taskStatuses.CRASHED;
            }
            else {
                retries += 1;
                err = 'StalledState';
                status = taskStatuses.STALLED;
                this._addQueue(tasks);
            }
            const error = `node ${task.nodeName} is in ${err}, attempts: ${retries}/${maxAttempts}`;
            log.warning(`${error} ${jobId} `, { component, jobId });
            await db.updateTask({ jobId, taskId, status, error, retries });
        });
    }

    _taskToProducerJob({ jobId, taskId, spanId }) {
        return {
            job: {
                id: `${taskId}-${uuidv4()}`,
                type: this._algorithmName,
                data: { jobId, taskId }
            },
            tracing: {
                parent: spanId,
                tags: {
                    jobId,
                    taskId
                }
            }
        };
    }

    async createJob() {
        if (!this._producer) {
            return null;
        }
        const task = this._tryPop();
        if (task) {
            const { jobId, taskId, status, spanId } = task;
            log.info(`pop new task with taskId: ${taskId} for ${jobId}, score: ${task.calculated.score}, Queue length: ${this._getQueue().length}`, { component, jobId, taskId });
            const job = this._taskToProducerJob({ jobId, taskId, spanId });
            // we don't want to update preschedule task for worker to take action
            if (status !== taskStatuses.PRESCHEDULE) {
                await db.updateTask({ taskId, status: taskStatuses.DEQUEUED });
            }
            return this._producer.createJob(job);
        }
        return null;
    }
}

module.exports = JobProducer;
