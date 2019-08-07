const Etcd = require('@hkube/etcd');
const { Events } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const uuidv4 = require('uuid/v4');
const producerSingleton = require('./producer-singleton');
const { componentName, jobState, taskStatus } = require('../consts/index');
const queueRunner = require('../queue-runner');

const MAX_JOB_ATTEMPTS = 3;

class JobProducer {
    async init(options) {
        const { etcd, serviceName } = options;
        this.etcd = new Etcd({ ...etcd, serviceName });
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
            await this.createJob();
        });
        this._producer.on(Events.COMPLETED, (data) => {
            log.debug(`${Events.COMPLETED} ${data.jobId}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            log.error(`${Events.FAILED} ${data.jobId}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobId: data.jobId, status: jobState.FAILED });
        });
        this._producer.on(Events.STUCK, async (job) => {
            const { jobId, taskId, nodeName } = job.options;
            let err;
            let status;
            const task = this._pipelineToQueueAdapter(job.options);
            let { attempts } = task;

            if (attempts > MAX_JOB_ATTEMPTS) {
                attempts = MAX_JOB_ATTEMPTS;
                err = 'CrashLoopBackOff';
                status = taskStatus.CRASHED;
            }
            else {
                err = 'StalledState';
                status = taskStatus.STALLED;
                queueRunner.queue.add([task]);
            }
            const error = `node ${nodeName} is in ${err}, attempts: ${attempts}/${MAX_JOB_ATTEMPTS}`;
            log.error(`${error} ${job.jobId} `, { component: componentName.JOBS_PRODUCER, jobId });
            await this.etcd.jobs.tasks.set({ jobId, taskId, status, error, retries: attempts });
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
            log.info(`pop new task with taskId: ${task.taskId}, score: ${task.calculated.score}`, { component: componentName.JOBS_PRODUCER });
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }
        log.info('queue is empty ', { component: componentName.JOBS_PRODUCER });
        return null;
    }
}

module.exports = new JobProducer();
