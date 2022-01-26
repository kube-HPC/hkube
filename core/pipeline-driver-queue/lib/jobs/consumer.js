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
        this._jobType = options.consumer.jobType;
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: options.consumer.prefix
            }
        });
        this._consumer.register({
            job: {
                type: options.consumer.jobType,
                concurrency: options.consumer.concurrency
            }
        });
        this._consumer.on('job', (job) => {
            this._handleJob(job);
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
        let error;
        try {
            const { jobId } = job.data;
            const jobData = await dataStore.getJob({ jobId });
            const { status, pipeline } = jobData || {};
            if (!pipeline) {
                throw new Error(`unable to find pipeline for job ${jobId}`);
            }
            if (status.status === pipelineStatuses.STOPPED || status.status === pipelineStatuses.PAUSED) {
                log.warning(`job ${jobId} arrived with state ${status.status} therefore will not added to queue`, { component });
                this._stopJob(jobId, status.status);
            }
            else {
                await dataStore.setJobStatus({ jobId, status: pipelineStatuses.QUEUED });
                if (pipeline.concurrency?.limit) {
                    const { current, max } = pipeline.concurrency;
                    log.warning(`job ${jobId} arrived with concurrency limit, ${current}/${max}`, { component });
                }
                this._queueJob({ jobId, pipeline });
            }
        }
        catch (e) {
            error = e.message;
            log.error(error, { component }, e);
        }
        finally {
            job.done(error);
        }
    }

    _stopJob(jobId, status) {
        log.info(`job ${status} ${jobId}`, { component });
        queueRunner.preferredQueue.remove(jobId);
        queueRunner.queue.remove(jobId);
    }

    _queueJob({ jobId, pipeline }) {
        queueRunner.queue.enqueue({ jobId, pipeline });
    }
}

module.exports = new JobConsumer();
