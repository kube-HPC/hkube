const Etcd = require('@hkube/etcd');
const { Events } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { uuid: uuidv4 } = require('@hkube/uid');
const producerSingleton = require('./producer-singleton');
const { componentName } = require('../consts/index');
const queueRunner = require('../queue-runner');

const MAX_JOB_ATTEMPTS = 3;

class JobProducer {
    async init(options) {
        const { etcd, serviceName, producerUpdateInterval } = options;
        this._producerUpdateInterval = producerUpdateInterval;
        this.etcd = new Etcd({ ...etcd, serviceName });
        this._producer = producerSingleton.get;
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    // should handle cases where there is currently not any active job and new job added to queue
    _checkWorkingStatusInterval() {
        setInterval(async () => {
            if (queueRunner.queue.get.length > 0) {
                const waitingCount = await producerSingleton.queue.getWaitingCount();
                if (waitingCount === 0) {
                    await this.createJob();
                }
            }
        }, this._producerUpdateInterval);
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.taskId;
            log.info(`${Events.WAITING} ${jobId} ${taskId}`, { component: componentName.JOBS_PRODUCER, jobId, taskId, status: Events.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.taskId;
            log.info(`${Events.ACTIVE} ${jobId} ${taskId}`, { component: componentName.JOBS_PRODUCER, jobId, taskId, status: Events.ACTIVE });
            await this.createJob();
        });
        this._producer.on(Events.COMPLETED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.taskId;
            log.info(`${Events.COMPLETED} ${jobId} ${taskId}`, { component: componentName.JOBS_PRODUCER, jobId, taskId, status: Events.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.taskId;
            log.info(`${Events.FAILED} ${jobId} ${taskId} error: ${data?.error}`, { component: componentName.JOBS_PRODUCER, jobId, taskId, status: Events.FAILED });
        });
        this._producer.on(Events.STUCK, async (job) => {
            const { jobId, taskId, nodeName, batchIndex, retry, status: jobStatus } = job.options;
            if (jobStatus === taskStatuses.PRESCHEDULE) {
                log.info(`${Events.STUCK} ${jobId} ${taskId} ${jobStatus}`, { component: componentName.JOBS_PRODUCER, jobId, taskId, status: jobStatus, event: Events.STUCK });
                return;
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
                queueRunner.queue.add([task]);
            }
            const error = `node ${nodeName} is in ${err}, attempts: ${attempts}/${maxAttempts}`;
            log.warning(`${error} ${jobId} ${taskId}`, { component: componentName.JOBS_PRODUCER, jobId, taskId });
            await this.etcd.jobs.tasks.set({ jobId, taskId, nodeName, batchIndex, status, error, retries: attempts });
        });
    }

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
        const task = queueRunner.queue.tryPop();
        if (task) {
            log.info(`pop new task with taskId: ${task.taskId} for ${task.jobId}, score: ${task.calculated.score}`,
                { component: componentName.JOBS_PRODUCER, jobId: task.jobId, taskId: task.taskId });
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }
        log.info('queue is empty ', { component: componentName.JOBS_PRODUCER });
        return null;
    }
}

module.exports = new JobProducer();
