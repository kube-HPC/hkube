const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');
const producer = require('../jobs/producer');
const { jobState } = require('../consts');

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
        this._consumer.register({ job: { type: options.consumer.jobType } });
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
            const { jobId } = job.data;
            const pipeline = await persistence.getExecution({ jobId });
            if (!pipeline) {
                throw new Error(`unable to find pipeline for job ${jobId}`);
            }
            const watchState = await persistence.watchJobState({ jobId });
            if (watchState && watchState.state === jobState.STOP) {
                await this._stopJob(jobId, pipeline, watchState.reason);
            }
            else {
                await this._queueJob(pipeline, job);
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
        const status = jobState.STOPPED;
        queueRunner.queue.remove(jobId);
        this._updateState();
        await persistence.setJobStatus({ jobId, pipeline: pipeline.name, status, level: 'info' });
        await persistence.setJobResults({ jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason, status });
        await persistence.unWatchJobState({ jobId });
    }

    async _queueJob(pipeline, job) {
        const jobs = this._pipelineToQueueAdapter(pipeline, job);
        queueRunner.queue.add(jobs);
        this._updateState();
    }

    async _updateState() {
        const pendingAmount = await producer.getWaitingCount();
        await queueRunner.queue.persistenceStore({ pendingAmount });
    }

    _pipelineToQueueAdapter(pipeline, job) {
        return {
            jobId: job.data.jobId,
            spanId: job.data.spanId,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            entranceTime: Date.now(),
            calculated: {
                latestScores: {}
            }
        };
    }
}

module.exports = new JobConsumer();

