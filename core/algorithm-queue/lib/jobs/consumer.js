const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const { pipelineStatuses } = require('@hkube/consts');
const { tracer } = require('@hkube/metrics');
const db = require('../persistency/db');
const { heuristicsName } = require('../consts/index');
const queueRunner = require('../queue-runner');
const component = require('../consts/component-name').JOBS_CONSUMER;

const pipelineDoneStatus = [pipelineStatuses.COMPLETED, pipelineStatuses.FAILED, pipelineStatuses.STOPPED];

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
        this.etcd.jobs.status.on('change', (data) => {
            const { status, jobId } = data;
            if (this._isCompletedState({ status })) {
                this._removeInvalidJob({ jobId });
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

    _isCompletedState({ status }) {
        return pipelineDoneStatus.includes(status);
    }

    _removeInvalidJob({ jobId }) {
        queueRunner.queue.removeJobs([{ jobId }]);
    }

    async _handleJob(job) {
        try {
            const { jobId } = job.data;
            const data = await db.getJob({ jobId });
            log.info(`job arrived with ${data.status} state and ${job.data.tasks.length} tasks`, { component });
            if (this._isCompletedState({ status: data.status })) {
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
