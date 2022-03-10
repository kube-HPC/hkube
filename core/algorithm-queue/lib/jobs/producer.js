const { Events } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { uuid: uuidv4 } = require('@hkube/uid');
const { tracer } = require('@hkube/metrics');
const { Producer } = require('@hkube/producer-consumer');
const component = require('../consts/component-name').JOBS_PRODUCER;
const { isCompletedState } = require('../utils/pipelineStatuses');
const db = require('../persistency/db');
const etcd = require('../persistency/etcd');
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
            const { jobId, taskId, nodeName, retry } = job.options;
            const data = await db.getJob({ jobId });
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
            const maxAttempts = retry?.limit ?? MAX_JOB_ATTEMPTS;
            const task = this._pipelineToQueueAdapter(job.options);
            let { attempts } = task;

            if (attempts > maxAttempts) {
                attempts = maxAttempts;
                err = 'CrashLoopBackOff';
                status = taskStatuses.CRASHED;
            }
            else {
                err = 'StalledState';
                status = taskStatuses.STALLED;
                this._addQueue([task]);
            }
            const error = `node ${nodeName} is in ${err}, attempts: ${attempts}/${maxAttempts}`;
            log.warning(`${error} ${job.jobId} `, { component, jobId });
            await etcd.updateTask({ jobId, taskId, status, error, retries: attempts });
        });
    }

    // TODO: remove this calculated stuff....
    _pipelineToQueueAdapter(taskData) {
        return {
            initialBatchLength: 1,
            calculated: {
                latestScores: {},
                entranceTime: taskData.entranceTime,
                enrichment: {
                    batchIndex: {}
                }
            },
            ...taskData,
            attempts: taskData.attempts + 1
        };
    }

    _taskToProducerJob(task) {
        const { calculated, initialBatchLength, ...taskData } = task;
        return {
            job: {
                id: `${task.taskId}-${uuidv4()}`,
                type: task.algorithmName,
                data: taskData
            },
            tracing: {
                parent: taskData.spanId,
                tags: {
                    jobId: task.jobId,
                    taskId: task.taskId
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
            log.info(`pop new task with taskId: ${task.taskId} for ${task.jobId}, score: ${task.calculated.score}, Queue length: ${this._getQueue().length}`,
                { component, jobId: task.jobId, taskId: task.taskId });
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }
        return null;
    }
}

module.exports = JobProducer;
