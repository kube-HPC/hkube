const asyncQueue = require('async/queue');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const dataStore = require('../persistency/data-store');
const queueRunner = require('../queue-runner');
const { componentName } = require('../consts');
const component = componentName.JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._consumer = null;
    }

    async init(options) {
        const { prefix, jobType, concurrency, maxStalledCount, incomingJobQueueConcurrency } = options.consumer;
        this._jobType = jobType;
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix,
                settings: { maxStalledCount }
            }
        });
        this._incomingJobQueue = asyncQueue(async (job) => {
            const ret = await this._handleJob(job);
            return ret;
        }, incomingJobQueueConcurrency);
        this._incomingJobQueue.error((err) => {
            log.error(`error in incoming job queue ${err.message}`, { component }, err);
        });
        this._consumer.register({
            job: {
                type: options.consumer.jobType,
                concurrency
            }
        });
        this._consumer.on('job', (job) => {
            this._incomingJobQueue.push(job);
        });
        dataStore.on(`job-${pipelineStatuses.STOPPED}`, (job) => {
            const { jobId, status } = job;
            this._stopJob(jobId, status);
        });
        dataStore.on(`job-${pipelineStatuses.PAUSED}`, (job) => {
            const { jobId, status } = job;
            this._stopJob(jobId, status);
        });
    }

    async shutdown() {
        if (!this._isPaused && this._consumer) {
            this._isPaused = true;
            await this._consumer.pause({ type: this._jobType });
        }
    }

    async _handleJob(job) {
        const { jobId } = job.data;
        const jobData = await dataStore.getJob({ jobId });
        const { status, pipeline } = jobData || {};
        if (!pipeline) {
            throw new Error(`unable to find pipeline for job ${jobId}`);
        }
        if (status.status === pipelineStatuses.STOPPED || status.status === pipelineStatuses.PAUSED) {
            log.warning(`job arrived with state stop therefore will not added to queue ${jobId}`, { component });
            this._stopJob(jobId, status.status);
            job.done();
        }
        else {
            if (pipeline.maxExceeded) {
                log.info(`job "${jobId}" arrived with maxExceeded flag`, { component });
            }
            this._queueJob({ jobId, pipeline, job });
            job.done();
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
            const { pipeline } = await dataStore.getJob({ jobId });
            const startTime = pipeline?.startTime || Date.now();
            const pipelineName = pipeline?.name;
            await dataStore.setJobResults({ jobId, error, status, startTime, pipeline: pipelineName });
            await dataStore.setJobStatus({ jobId, status, error, pipeline: pipelineName });
        }
        catch (e) {
            log.error(e.message, { component, jobId }, e);
        }
    }

    _stopJob(jobId, status) {
        log.info(`job ${status} ${jobId}`, { component });
        const { job, queue } = queueRunner.findJobByJobId(jobId);
        if (job) {
            queue.remove(jobId);
        }
        queueRunner.jobRemovedFromQueue(job);
    }

    _queueJob({ jobId, pipeline, job }) {
        const jobData = this._pipelineToQueueAdapter({ jobId, pipeline, job });
        queueRunner.queue.enqueue(jobData);
        queueRunner.jobAddedToQueue(jobData);
    }

    _pipelineToQueueAdapter({ jobId, pipeline, job }) {
        return {
            jobId,
            done: () => job.done(),
            experimentName: pipeline.experimentName,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            maxExceeded: pipeline.maxExceeded,
            entranceTime: pipeline.startTime || Date.now(),
            tags: pipeline.tags || [],
            calculated: {
                latestScores: {}
            }
        };
    }
}

module.exports = new JobConsumer();
