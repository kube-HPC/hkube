const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const { jobPrefix, componentName } = require('../consts');
const component = componentName.CONSUMER;
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: jobPrefix.JOB_PREFIX
            }
        });
        this._consumer.register({ job: { type: options.consumer.jobType } });
        this._consumer.on('job', job => {
            this.queueTasksBuilder(job);
        });
    }

    pipelineToQueueAdapter(pipeline, jobId) {
        return {
            priority: pipeline.priority,
            jobId,
            calculated: {
                latestScores: {},
                //  score: '1-100',
                entranceTime: Date.now()
            }
        };
    }

    async queueTasksBuilder(job) {
        const pipeline = await persistence.getExecution({ jobId: job.data.jobId });
        const jobs = this.pipelineToQueueAdapter(pipeline, job.data.jobId);
        queueRunner.queue.add([jobs]);
        job.done();
    }
}

module.exports = new JobConsumer();

