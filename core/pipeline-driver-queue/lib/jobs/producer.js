const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const ConcurrencyHandler = require('./concurrencyHandler');
const queueRunner = require('../queue-runner');

class JobProducer {
    constructor() {
        this._isActive = false;
        this._isConsumerActive = true;
        this._firstJobDequeue = false;
        this._checkQueue = this._checkQueue.bind(this);
        this._updateState = this._updateState.bind(this);
    }

    async init(options) {
        const { jobType, ...producer } = options.producer;
        this._jobType = jobType;
        this._prefix = options.producer.prefix;
        this.redisPrefix = `${this._prefix}:${this._jobType}`;
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...producer
            }
        });
        this._isActive = true;
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
    }

    shutdown() {
        this._isActive = false;
    }

    async _checkQueue() {
        try {
            const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
            if (queue.length > 0) {
                const pendingAmount = await this._redisQueue.getWaitingCount();
                if (pendingAmount === 0) {
                    // create job first time only, then rely on 3 events (active/completed/enqueue)
                    this._firstJobDequeue = true;
                    log.info('firstJobDequeue', { component });
                    await this.createJob(queue[0], queueRunner.queue);
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
            await queueRunner.queue.persistenceStore();
            await queueRunner.preferredQueue.persistenceStore();
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
        finally {
            if (this._isActive) {
                setTimeout(this._updateState, this._updateStateInterval);
            }
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
            this._concurrencyHandler.checkMaxExceeded({ pipelineName: data.options.data.pipeline, experimentName: data.options.data.experiment });
        }).on(Events.FAILED, (data) => {
            log.info(`${Events.FAILED} ${data.jobId}, ${data.error}`, { component, jobId: data.jobId, status: Events.FAILED });
            this._concurrencyHandler.checkMaxExceeded({ pipelineName: data.options.data.pipeline, experimentName: data.options.data.experiment });
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
    async _dequeueJobInternal(jobId) {
        try {
            if (jobId) {
                const { job, queue } = queueRunner.findJobByJobId(jobId);
                if (job) {
                    await this.createJob(job, queue);
                    return;
                }
            }
            for (const queue of queueRunner.queues) {
                const availableJobs = queue.getQueue(q => !q.maxExceeded);
                if (availableJobs.length > 0) {
                    const job = availableJobs[0];
                    await this.createJob(job, queue);
                    return;
                }
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

    async dequeueJob(jobId) {
        if (this._isConsumerActive) {
            await this._dequeueJobInternal(jobId);
        }
    }

    async createJob(job, queue) {
        queue.dequeue(job);
        log.info(`creating new job ${job.jobId}`, { component, jobId: job.jobId });
        this._concurrencyHandler.updateActiveJobs(job);
        const jobData = this._pipelineToJob(job);
        await this._producer.createJob(jobData);
    }
}

module.exports = new JobProducer();
