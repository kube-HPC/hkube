const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses, pipelineTypes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const persistence = require('../persistency/persistency');
const dataStore = require('../persistency/data-store');
const queueRunner = require('../queue-runner');
const concurrencyMap = require('./concurrency-map');

class JobProducer {
    constructor() {
        this._isActive = false;
        this._isConsumerActive = false;
        this._firstJobDequeue = false;
        this._checkQueue = this._checkQueue.bind(this);
        this._updateState = this._updateState.bind(this);
        this._checkConcurrencyJobsInterval = this._checkConcurrencyJobsInterval.bind(this);
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
        this._isActive = true;
        this._redisQueue = this._producer._createQueue(this._jobType);
        this._checkQueueInterval = options.checkQueueInterval;
        this._updateStateInterval = options.updateStateInterval;
        this._checkConcurrencyQueueInterval = options.checkConcurrencyQueueInterval;

        this._producerEventRegistry();
        this._checkQueue();
        await this._checkConcurrencyJobsInterval();
        this._updateState();

        queueRunner.queue.on(queueEvents.INSERT, () => {
            if (this._isConsumerActive) {
                this._dequeueJob();
            }
        });
    }

    async _checkConcurrencyJobsInterval() {
        try {
            await this._checkConcurrencyJobs();
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
        }
        finally {
            setTimeout(this._checkConcurrencyJobsInterval, this._checkConcurrencyQueueInterval);
        }
    }

    /**
     * 1. get jobs that are from: type stored, active and has concurrency
     * 2. get stored pipelines list
     * 3. build map of pipelineName: {count, max}
     *
     */
    async _checkConcurrencyJobs() {
        const activeJobs = await persistence.getConcurrentActiveJobs();
        const storedPipelines = await persistence.getStoredPipelines({ pipelinesNames });

        storedPipelines.forEach((p) => {
            const count = activeJobs.filter(a => a.name === p.name);
            concurrencyMap.add(p.name, count, p.max);
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
            this._dequeueJob();
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
            await persistence.setJobStatus({ jobId, status, error, level: 'error' });
            await persistence.setJobResults({ jobId, status, error });
        });
    }

    /**
     * This method executes if one of the following conditions are met:
     * 1. active event.
     * 2  completed active and there is a maxExceeded in queue.
     * 3. new job enqueue and consumers are active.
     */
    async _dequeueJob() {
        try {
            const preferredQueue = queueRunner.preferredQueue.getQueue(q => !q.maxExceeded);
            if (preferredQueue.length > 0) {
                await this.createJob(preferredQueue[0], queueRunner.preferredQueue);
            }
            else {
                const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
                if (queue.length > 0) {
                    await this.createJob(queue[0], queueRunner.queue);
                }
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
    }

    _checkMaxExceeded({ experiment, pipeline }) {
        let job = queueRunner.preferredQueue
            .getQueue(q => q.maxExceeded)
            .find(q => q.experimentName === experiment && q.pipelineName === pipeline);
        if (!job) {
            job = queueRunner.queue
                .getQueue(q => q.maxExceeded)
                .find(q => q.experimentName === experiment && q.pipelineName === pipeline);
        }
        if (job) {
            log.info(`found and disable job with experiment ${experiment} and pipeline ${pipeline} that marked as maxExceeded`, { component });
            job.maxExceeded = false;
            if (this._isConsumerActive) {
                this._dequeueJob();
            }
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

    async createJob(job, queue) {
        queue.dequeue(job);
        log.debug(`creating new job ${job.jobId}, calculated score: ${job.score}`, { component });
        const jobData = this._pipelineToJob(job);
        await dataStore.setJobStatus({ jobId: job.jobId, status: pipelineStatuses.DEQUEUED });
        await this._producer.createJob(jobData);
    }
}

module.exports = new JobProducer();
