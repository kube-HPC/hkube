const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const { pipelineStatuses } = require('@hkube/consts');
const { tracer } = require('@hkube/metrics');
const db = require('../persistency/db');
const { heuristicsName } = require('../consts/index');
const queueRunner = require('../queue-runner');
const { isCompletedState } = require('../utils/pipelineStatuses');
const component = require('../consts/component-name').JOBS_CONSUMER;
const producerSingleton = require('./producer-singleton');

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._active = false;
    }

    async init(options) {
        const { etcd, serviceName, algorithmType } = options;
        this._options = options;
        this.etcd = new Etcd({ ...etcd, serviceName });
        await this.etcd.jobs.status.watch();
        await this.etcd.algorithms.executions.watch();

        log.info(`registering for job ${options.algorithmType}`, { component });

        this._consumer = new Consumer({ setting: { redis: options.redis, tracer, prefix: options.consumer.prefix } });
        this._consumer.on('job', (job) => {
            this._handleJob(job);
        });
        this.etcd.jobs.status.on('change', async (data) => {
            const { status, jobId } = data;
            if (isCompletedState({ status })) {
                this._removeInvalidJob({ jobId });
                await this._removeWaitingJobs({ jobId, status });
            }
        });
        this.etcd.algorithms.executions.on('change', (data) => {
            if (data && data.status === pipelineStatuses.STOPPED) {
                const { jobId, taskId } = data;
                queueRunner.queue.removeJobs([{ jobId, taskId }]);
            }
        });
        this._consumer.register({ job: { type: algorithmType, concurrency: options.consumer.concurrency } });
    }

    _removeInvalidJob({ jobId }) {
        queueRunner.queue.removeJobs([{ jobId }]);
    }

    async _removeWaitingJobs({ jobId, status }) {
        const removeJob = async (job) => {
            try {
                await job.discard();
                await job.remove();
                return { removed: true };
            }
            catch (error) {
                return { removed: false, error: error.message };
            }
        };
        try {
            const waitingJobs = await producerSingleton.queue.getWaiting();
            const pendingJobs = waitingJobs.filter(j => j.data?.jobId === jobId);
            const removeResults = await Promise.all(pendingJobs.map(removeJob));
            const failedToRemove = removeResults.filter(r => r.error);
            log.info(`job ${jobId} with state ${status}: removed ${pendingJobs.length} waiting tasks.`, { component });
            if (failedToRemove.length) {
                log.warning(`${failedToRemove.length} failed to remove`, { component });
            }
        }
        catch (error) {
            log.error(`Failed to remove pending jobs for jobId ${jobId}`, { component }, error);
        }
    }

    async _handleJob(job) {
        try {
            const { jobId } = job.data;
            const data = await db.getJob({ jobId });
            log.info(`job arrived with ${data.status} state and ${job.data.tasks.length} tasks`, { component });
            if (isCompletedState({ status: data.status })) {
                this._removeInvalidJob({ jobId });
            }
            else {
                this.queueTasksBuilder(job);
            }
        }
        catch (error) {
            job.done(error);
        }
        finally {
            job.done();
        }
    }

    pipelineToQueueAdapter(jobData, taskData, initialBatchLength) {
        const latestScores = Object.values(heuristicsName).reduce((acc, cur) => {
            acc[cur] = 0.00001;
            return acc;
        }, {});
        const batchIndex = taskData.batchIndex || 0;
        const entranceTime = Date.now();

        return {
            ...jobData,
            ...taskData,
            entranceTime,
            attempts: 0,
            initialBatchLength,
            batchIndex,
            calculated: {
                latestScores,
                //  score: '1-100',
                entranceTime,
                enrichment: {
                    batchIndex: {}
                }
            },
        };
    }

    queueTasksBuilder(job) {
        const { tasks, ...jobData } = job.data;
        const taskList = tasks.map(task => this.pipelineToQueueAdapter(jobData, task, tasks.length));
        queueRunner.queue.add(taskList);
        job.done();
    }
}

module.exports = new JobConsumer();
