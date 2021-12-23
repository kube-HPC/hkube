const { Consumer } = require('@hkube/producer-consumer');
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
        const { prefix, jobType, concurrency, maxStalledCount } = options.consumer;
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix,
                settings: { maxStalledCount }
            },
        });
        this._consumer.register({ job: { type: jobType, concurrency } });
        this._consumer.on('job', (job) => {
            this._handleJob(job);
        });
        persistence.on(`job-${pipelineStatuses.STOPPED}`, async (job) => {
            const { jobId, status } = job;
            await this._stopJob(jobId, status);
        });
        persistence.on(`job-${pipelineStatuses.PAUSED}`, async (job) => {
            const { jobId, status } = job;
            await this._stopJob(jobId, status);
        });
    }

    async _handleJob(job) {
        const { jobId } = job.data;
        const pipeline = await persistence.getExecution({ jobId });
        if (!pipeline) {
            throw new Error(`unable to find pipeline for job ${jobId}`);
        }
        const jobStatus = await persistence.getJobStatus({ jobId });
        if (jobStatus.status === pipelineStatuses.STOPPED || jobStatus.status === pipelineStatuses.PAUSED) {
            log.warning(`job arrived with state stop therefore will not added to queue ${jobId}`, { component });
            await this._stopJob(jobId, jobStatus.status);
        }
        else {
            await this._queueJob(pipeline, job);
        }
    }

    async _stopJob(jobId, status) {
        log.info(`job ${status} ${jobId}`, { component });
        queueRunner.queue.remove(jobId);
    }

    async _queueJob(pipeline, job) {
        const jobData = this._pipelineToQueueAdapter(pipeline, job);
        queueRunner.queue.enqueue(jobData);
    }

    _pipelineToQueueAdapter(pipeline, job) {
        return {
            ...job.data,
            done: () => job.done(),
            pipelineName: pipeline.name,
            experimentName: pipeline.experimentName,
            priority: pipeline.priority,
            entranceTime: Date.now(),
            calculated: {
                latestScores: {}
            }
        };
    }
}

module.exports = new JobConsumer();
