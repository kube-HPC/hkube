const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const queueRunner = require('../queue-runner');
const ConcurrencyHandler = require('./concurrencyHandler');

class JobProducer {
    constructor() {
        this._isConsumerActive = false;
        this._firstJobDequeue = false;
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
        this._isConsumerActive = true;
        this._redisQueue = this._producer._createQueue(this._jobType);
        this._checkQueueInterval = options.checkQueueInterval;
        this._updateStateInterval = options.updateStateInterval;
        this._concurrencyHandler = new ConcurrencyHandler(this, options);
        this._producerEventRegistry();
        this._checkQueue();
        this._concurrencyHandler.startInterval();
        this._updateState();

        queueRunner.queue.on(queueEvents.INSERT, () => {
            if (this._isConsumerActive) {
                this._dequeueJobInternal();
            }
        });
        queueRunner.queue.on(queueEvents.REMOVE, (job) => {
            job.done && job.done();
        });
    }

    async _checkQueue() {
        try {
            const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
            if (queue.length > 0) {
                const pendingAmount = await this._redisQueue.getWaitingCount();
                if (pendingAmount === 0) {
                    // create job first time only, then rely on 3 events (active/completed/enqueue)
                    this._firstJobDequeue = true;
                    await this.createJob({ jobId: queue[0].jobId });
                }
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
        finally {
            if (!this._firstJobDequeue) {
                setTimeout(this._checkQueue, this._checkQueueInterval);
            }
        }
    }

    async _updateState() {
        try {
            const queue = queueRunner.queue.getQueue();
            await queueRunner.queue.persistenceStore(queue);
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
            this._isConsumerActive = false;
            log.info(`${Events.WAITING} ${data.jobId}`, { component, jobId: data.jobId, status: Events.WAITING });
        }).on(Events.ACTIVE, (data) => {
            this._isConsumerActive = true;
            log.info(`${Events.ACTIVE} ${data.jobId}`, { component, jobId: data.jobId, status: Events.ACTIVE });
            this._dequeueJobInternal();
        }).on(Events.COMPLETED, (data) => {
            log.info(`${Events.COMPLETED} ${data.jobId}`, { component, jobId: data.jobId, status: Events.COMPLETED });
            this._concurrencyHandler._checkMaxExceeded(data.options.data);
        }).on(Events.FAILED, (data) => {
            log.info(`${Events.FAILED} ${data.jobId}, ${data.error}`, { component, jobId: data.jobId, status: Events.FAILED });
            this._concurrencyHandler._checkMaxExceeded(data.options.data);
        }).on(Events.STALLED, (data) => {
            log.warning(`${Events.STALLED} ${data.jobId}`, { component, jobId: data.jobId, status: Events.STALLED });
        });
    }

    /**
     * This method executes if one of the following conditions are met:
     * 1. active event.
     * 2  completed active and there is a maxExceeded in queue.
     * 3. new job enqueue and consumers are active.
     */
    async _dequeueJobInternal() {
        try {
            const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
            if (queue.length > 0) {
                await this.createJob({ jobId: queue[0].jobId });
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
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

    async dequeueJob() {
        if (this._isConsumerActive) {
            this._dequeueJobInternal();
        }
    }

    // we only want to call done after finish with job
    async createJob({ jobId }) {
        const job = queueRunner.queue.dequeue(jobId);
        if (!job) {
            log.error(`trying to create job ${jobId} which is not exists in queue`, { component });
            return;
        }

        log.debug(`creating new job ${jobId}, calculated score: ${job.score}`, { component });
        const jobData = this._pipelineToJob(job);
        await this._producer.createJob(jobData);
        job.done && job.done();
    }
}

module.exports = new JobProducer();
