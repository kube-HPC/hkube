const { Events } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { uuid: uuidv4 } = require('@hkube/uid');
const { tracer } = require('@hkube/metrics');
const { Producer } = require('@hkube/producer-consumer');
const { componentName } = require('../consts/index');
const { isCompletedState } = require('../utils/pipelineStatuses');
const db = require('../persistency/db');
const etcd = require('../persistency/etcd');
const MAX_JOB_ATTEMPTS = 3;

class JobProducer {
    constructor(options) {
        const { algorithmName, producerUpdateInterval } = options;
        this._getQueue = options.getQueue;
        this._addQueue = options.addQueue;
        this._tryPop = options.tryPop;
        this._producerUpdateInterval = producerUpdateInterval;
        this._producer = new Producer({
            setting: {
                redis: options.redis,
                tracer,
                ...options.producer
            }
        });
        this._producerQueue = this._producer._createQueue(algorithmName);
    }

    start() {
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    stop() {
        this._producer.stopWork();
        clearInterval(this._interval);
        this._interval = null;
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
            if (this._getQueue().length > 0) {
                const waitingCount = await this.getWaitingCount();
                if (waitingCount === 0) {
                    await this.createJob();
                }
            }
        }, this._producerUpdateInterval);
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: Events.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            log.info(`${Events.ACTIVE} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: Events.ACTIVE });
            await this.createJob();
        });
        this._producer.on(Events.COMPLETED, (data) => {
            log.debug(`${Events.COMPLETED} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: Events.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            log.info(`${Events.FAILED} ${data.jobId}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: Events.FAILED });
        });
        this._producer.on(Events.STUCK, async (job) => {
            const { jobId, taskId, nodeName, retry } = job.options;
            const data = await db.getJob({ jobId });
            if (data) {
                log.info(`job stalled with ${data.status} status`, { component: componentName.JOBS_PRODUCER });
                if (isCompletedState({ status: data.status })) {
                    log.info(`completed job stalled with ${data.status} status. Skipping`, { component: componentName.JOBS_PRODUCER });
                    return;
                }
            }
            let err;
            let status;
            const maxAttempts = (retry && retry.limit) || MAX_JOB_ATTEMPTS;
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
            log.warning(`${error} ${job.jobId} `, { component: componentName.JOBS_PRODUCER, jobId });
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
        const task = this._tryPop();
        if (task) {
            log.info(`pop new task with taskId: ${task.taskId}, score: ${task.calculated.score}`, { component: componentName.JOBS_PRODUCER });
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }
        log.info('queue is empty', { component: componentName.JOBS_PRODUCER });
        return null;
    }
}

module.exports = JobProducer;
