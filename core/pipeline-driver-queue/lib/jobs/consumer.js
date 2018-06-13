const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');

class JobConsumer extends EventEmitter {
    constructor() {
        super();
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
        this._consumer.on('job', async job => {
            try {
                await this._queueTasksBuilder(job);
            }
            catch (error) {
                job.done(error);
            }
        });
    }

    _pipelineToQueueAdapter(pipeline, jobId) {
        return {
            jobId,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            entranceTime: Date.now(),
            calculated: {
                latestScores: {}
            }
        };
    }

    async _queueTasksBuilder(job) {
        const pipeline = await persistence.getExecution({ jobId: job.data.jobId });
        if (!pipeline) {
            throw new Error(`unable to find pipeline for job ${job.data.jobId}`);
        }
        const jobs = this._pipelineToQueueAdapter(pipeline, job.data.jobId);
        queueRunner.queue.add([jobs]);
        job.done();
    }
}

module.exports = new JobConsumer();

