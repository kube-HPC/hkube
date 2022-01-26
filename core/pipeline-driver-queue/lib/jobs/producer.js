const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
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
        this._isActive = true;
        this._updateStateInterval = options.updateStateInterval;

        this._producerEventRegistry();
        await this._updateIsConsumerActive();
        await this._buildConcurrencyJobs();

        queueRunner.queue.on(queueEvents.INSERT, () => {
            if (this._isConsumerActive) {
                this._dequeueJob();
            }
        });
        await queueRunner.queue.persistencyLoad();
        await queueRunner.preferredQueue.persistencyLoad(true);
        await this._updateState();
    }

    async _updateIsConsumerActive() {
        const pendingAmount = await this._getPendingAmount();
        this._isConsumerActive = pendingAmount === 0;
    }

    async _getPendingAmount() {
        const redisQueue = this._producer._createQueue(this._jobType);
        const pendingAmount = await redisQueue.getWaitingCount();
        return pendingAmount;
    }

    /**
     * 1. get jobs that are from: type stored, active and has concurrency
     * 2. build map of jobs <pipelineName, count>
     */
    async _buildConcurrencyJobs() {
        const activeJobs = await dataStore.getConcurrentActiveJobs();
        concurrencyMap.mapActiveJobs(activeJobs);
    }

    shutdown() {
        this._isActive = false;
    }

    async _updateState() {
        try {
            let data = queueRunner.queue.getQueue();
            data = queueRunner.preferredQueue.getQueue();
            const preferredData = data.map(q => {
                const { calculated, ...rest } = q;
                const result = { score: 1, ...rest };
                return result;
            });
            data = data.concat(preferredData);
            await this._persistency.store(data, 'pipeline-driver');
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
            this._checkConcurrencyLimit(data.options.data);
        }).on(Events.FAILED, (data) => {
            log.info(`${Events.FAILED} ${data.jobId}, ${data.error}`, { component, jobId: data.jobId, status: Events.FAILED });
            this._checkConcurrencyLimit(data.options.data);
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
     * 2  completed/failed job and there is a concurrency limit in queue.
     * 3. new job enqueue and consumers are active.
     */
    async _dequeueJob() {
        try {
            const preferredQueue = queueRunner.preferredQueue.getAvailableQueue();
            if (preferredQueue.length > 0) {
                await this.createJob(preferredQueue[0], queueRunner.preferredQueue);
            }
            else {
                const queue = queueRunner.queue.getAvailableQueue();
                if (queue.length > 0) {
                    await this.createJob(queue[0], queueRunner.queue);
                }
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
    }

    _checkConcurrencyLimit({ experiment, pipeline }) {
        let job = queueRunner.preferredQueue
            .getConcurrencyLimitQueue()
            .find(q => q.experimentName === experiment && q.pipelineName === pipeline && q.concurrency);
        if (!job) {
            job = queueRunner.queue
                .getConcurrencyLimitQueue()
                .find(q => q.experimentName === experiment && q.pipelineName === pipeline && q.concurrency);
        }
        if (job) {
            log.info(`found and disable job with experiment ${experiment} and pipeline ${pipeline} that marked with concurrency limit`, { component });
            concurrencyMap.disableConcurrencyLimit(job);
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
                    experiment: pipeline.experimentName,
                    concurrency: pipeline.concurrency
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

    // TODO Handle case when status changed to dequeued and job didn’t sent to Redis
    async createJob(job, queue) {
        queue.dequeue(job);
        log.debug(`creating new job ${job.jobId}, calculated score: ${job.score}`, { component });
        const jobData = this._pipelineToJob(job);
        await dataStore.setJobStatus({ jobId: job.jobId, status: pipelineStatuses.DEQUEUED });
        await this._producer.createJob(jobData);
    }
}

module.exports = new JobProducer();
