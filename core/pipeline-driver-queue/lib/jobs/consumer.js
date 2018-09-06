const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');
const { jobState } = require('../consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts');
const component = componentName.JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._consumer = null;
    }

    async init(options) {
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: options.consumer.prefix
            }
        });
        this._consumer.register({ job: { type: options.consumer.jobType, concurrency: options.consumer.concurrency } });
        this._consumer.on('job', (job) => {
            this._handleJob(job);
        });
        persistence.on('job-stop', async (job) => {
            const { jobId } = job;
            const pipeline = await persistence.getExecution({ jobId });
            await this._stopJob(jobId, pipeline, job.reason);
        });
    }

    async _handleJob(job) {
        try {
            const { jobId, spanId } = job.data;
            const pipeline = await persistence.getExecution({ jobId });
            if (!pipeline) {
                throw new Error(`unable to find pipeline for job ${jobId}`);
            }
            const watchState = await persistence.getJobState({ jobId });
            if (watchState && watchState.state === jobState.STOP) {
                log.warning(`job arrived with state stop therefore will not added to queue ${jobId}`, { component });
                await this._stopJob(jobId, pipeline, watchState.reason);
            }
            else {
                await this._queueJob(pipeline, jobId, spanId);
            }
        }
        catch (error) {
            job.done(error);
        }
        finally {
            job.done();
        }
    }

    async _stopJob(jobId, pipeline, reason) {
        const jobs = queueRunner.queue.remove(jobId);
        if (jobs.length > 0) {
            const status = jobState.STOPPED;
            await persistence.setJobStatus({ jobId, pipeline: pipeline.name, status, level: 'info' });
            await persistence.setJobResults({ jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason, status });
            await persistence.deleteTasksState({ jobId });
        }
    }

    async _queueJob(pipeline, jobId, spanId) {
        const job = this._pipelineToQueueAdapter(pipeline, jobId, spanId);
        queueRunner.queue.enqueue(job);
    }

    _pipelineToQueueAdapter(pipeline, jobId, spanId) {
        return {
            jobId,
            spanId,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            entranceTime: Date.now()
        };
    }
}

module.exports = new JobConsumer();

