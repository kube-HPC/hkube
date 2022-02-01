const asyncQueue = require('async/queue');
const { Consumer, Events } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');
const { componentName } = require('../consts');
const component = componentName.JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._consumer = null;
    }

    async init(options) {
        const { prefix, jobType, concurrency, maxStalledCount, incomingJobQueueConcurrency } = options.consumer;
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix,
                settings: { maxStalledCount }
            },
        });
        this._incomingJobQueue = asyncQueue(async (job) => {
            const ret = await this._handleJob(job);
            return ret;
        }, incomingJobQueueConcurrency);
        this._incomingJobQueue.error((err) => {
            log.error(`error in incoming job queue ${err.message}`, { component }, err);
        });
        this._consumer.register({ job: { type: jobType, concurrency } });
        this._consumer.on(Events.FAILED, (job) => {
            this._handleFailedJob(job);
        });
        this._consumer.on('job', (job) => {
            this._incomingJobQueue.push(job);
        });
        persistence.on(`job-${pipelineStatuses.STOPPED}`, (job) => {
            this._stopJob(job);
        });
        persistence.on(`job-${pipelineStatuses.PAUSED}`, (job) => {
            this._stopJob(job);
        });
    }

    async _handleJob(job) {
        const { jobId } = job.data;
        const pipeline = await persistence.getExecution({ jobId });
        if (!pipeline) {
            log.warning(`unable to find pipeline ${jobId}`, { component });
            return;
        }
        const jobStatus = await persistence.getJobStatus({ jobId });
        if (jobStatus.status === pipelineStatuses.STOPPED || jobStatus.status === pipelineStatuses.PAUSED) {
            log.warning(`job arrived with state stop therefore will not added to queue ${jobId}`, { component });
            this._stopJob({ jobId, status: jobStatus.status });
            job.done();
        }
        else {
            this._queueJob({ pipeline, jobId, job });
        }
    }

    async _handleFailedJob(job) {
        if (!job?.data?.jobId) {
            return;
        }
        const { jobId } = job.data;
        const error = job.failedReason;
        const status = pipelineStatuses.FAILED;
        if (error !== 'job stalled more than allowable limit') {
            log.warning(`Pipeline job failed. but with different error. jobId: ${jobId}, error: ${error}`, { component, jobId });
            return;
        }
        log.error(`Pipeline job failed. jobId: ${jobId}, error: ${error}`, { component, jobId });
        try {
            const pipeline = await persistence.getExecution({ jobId });
            const startTime = pipeline?.startTime || Date.now();
            const pipelineName = pipeline?.name;
            await persistence.setJobResults({ jobId, error, status, startTime, pipeline: pipelineName });
            await persistence.setJobStatus({ jobId, status, error, pipeline: pipelineName });
        }
        catch (e) {
            log.error(e.message, { component, jobId }, e);
        }
    }

    _stopJob({ jobId, status }) {
        log.info(`job ${status} ${jobId}`, { component });
        queueRunner.queue.remove(jobId);
    }

    _queueJob({ pipeline, jobId, job }) {
        const jobData = this._pipelineToQueueAdapter({ pipeline, jobId, job });
        queueRunner.queue.enqueue(jobData);
    }

    _pipelineToQueueAdapter({ pipeline, jobId, job }) {
        return {
            jobId,
            done: () => job.done(),
            pipelineName: pipeline.name,
            experimentName: pipeline.experimentName,
            priority: pipeline.priority,
            maxExceeded: pipeline.maxExceeded,
            entranceTime: pipeline.startTime || Date.now(),
            calculated: {
                latestScores: {}
            }
        };
    }
}

module.exports = new JobConsumer();
