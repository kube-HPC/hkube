const isEqual = require('lodash.isequal');
const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');

class JobProducer {
    constructor() {
        this._lastData = [];
        this._checkQueue = this._checkQueue.bind(this);
        this._updateState = this._updateState.bind(this);
    }

    async init(options) {
        const { jobType, ...producer } = options.producer;
        this._jobType = jobType;
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...producer
            }
        });
        this._redisQueue = this._producer._createQueue(this._jobType);
        this._checkQueueInterval = options.checkQueueInterval;
        this._updateStateInterval = options.updateStateInterval;

        this._producerEventRegistry();
        this._checkQueue();
        this._updateState();
    }

    async _checkQueue() {
        try {
            const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
            if (queue.length > 0) {
                const pendingAmount = await this._redisQueue.getWaitingCount();
                if (pendingAmount === 0) {
                    await this.createJob(queue[0]);
                }
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
        finally {
            setTimeout(this._checkQueue, this._checkQueueInterval);
        }
    }

    async _updateState() {
        try {
            const queue = [...queueRunner.queue.getQueue()];
            if (!isEqual(queue, this._lastData)) {
                await queueRunner.queue.persistenceStore(queue);
                this._lastData = queue;
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
        finally {
            setTimeout(this._updateState, this._updateStateInterval);
        }
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobId}`, { component, jobId: data.jobId, status: Events.WAITING });
        }).on(Events.ACTIVE, (data) => {
            log.info(`${Events.ACTIVE} ${data.jobId}`, { component, jobId: data.jobId, status: Events.ACTIVE });
        }).on(Events.COMPLETED, (data) => {
            log.info(`${Events.COMPLETED} ${data.jobId}`, { component, jobId: data.jobId, status: Events.COMPLETED });
            this._checkMaxExceeded(data.options.data);
        }).on(Events.FAILED, (data) => {
            log.info(`${Events.FAILED} ${data.jobId}, ${data.error}`, { component, jobId: data.jobId, status: Events.FAILED });
            this._checkMaxExceeded(data.options.data);
        }).on(Events.STALLED, (data) => {
            log.warning(`${Events.STALLED} ${data.jobId}`, { component, jobId: data.jobId, status: Events.STALLED });
        }).on(Events.CRASHED, async (data) => {
            const { jobId, error } = data;
            const status = pipelineStatuses.FAILED;
            log.warning(`${Events.CRASHED} ${jobId}`, { component, jobId, status });
            const pipeline = await persistence.getExecution({ jobId });
            await persistence.setJobStatus({ jobId, pipeline: pipeline.name, status, error, level: 'error' });
            await persistence.setJobResults({ jobId, pipeline: pipeline.name, status, error, startTime: pipeline.startTime });
        });
    }

    _checkMaxExceeded({ experiment, pipeline }) {
        const job = queueRunner.queue
            .getQueue(q => q.maxExceeded)
            .find(q => q.experimentName === experiment && q.pipelineName === pipeline);
        if (job) {
            log.info(`found and disable job with experiment ${experiment} and pipeline ${pipeline} that marked as maxExceeded`, { component });
            job.maxExceeded = false;
        }
    }

    _pipelineToJob(pipeline) {
        return {
            job: {
                id: pipeline.jobId,
                type: this._jobType,
                data: {
                    jobId: pipeline.jobId,
                    pipeline: pipeline.pipelineName,
                    experiment: pipeline.experimentName
                }
            },
            queue: {
                removeOnFail: true
            },
            tracing: {
                parent: pipeline.spanId,
                tags: {
                    jobId: pipeline.jobId,
                }
            }
        };
    }

    async createJob(job) {
        queueRunner.queue.dequeue(job);
        log.debug(`creating new job ${job.jobId}, calculated score: ${job.score}`, { component });
        const jobData = this._pipelineToJob(job);
        await this._producer.createJob(jobData);
    }
}

module.exports = new JobProducer();
