const groupBy = require('lodash.groupby');
const countBy = require('lodash.countby');
const { Events, Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses, pipelineTypes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');

class JobProducer {
    constructor() {
        this._isConsumerActive = false;
        this._firstJobDequeue = false;
        this._checkQueue = this._checkQueue.bind(this);
        this._checkConcurrencyJobsInterval = this._checkConcurrencyJobsInterval.bind(this);
        this._updateState = this._updateState.bind(this);
        this._groupActiveJobs = {};
        this._pipelines = {};
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
        this._checkConcurrencyQueueInterval = options.checkConcurrencyQueueInterval;
        this._updateStateInterval = options.updateStateInterval;

        this._producerEventRegistry();
        this._checkQueue();
        this._checkConcurrencyJobsInterval();
        this._updateState();

        queueRunner.queue.on(queueEvents.INSERT, () => {
            if (this._isConsumerActive) {
                this._dequeueJob();
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
     *
     * 1. check if there are any jobs in queue with concurrency limit
     * 2. get from db only jobs that are from type stored and active
     * 3. get stored pipelines list
     * 4. check the concurrent amount against the active amount
     * 5. mark the delta jobs maxExceeded property as false
     *
     */
    async _checkConcurrencyJobs() {
        let canceledJobs = 0;
        const queue = queueRunner.queue.getQueue(q => q.maxExceeded);
        if (queue.length === 0) {
            return canceledJobs;
        }
        const activeJobs = await persistence.getActiveJobs();
        const activePipelines = activeJobs.filter(r => r.status === pipelineStatuses.ACTIVE && r.types.includes(pipelineTypes.STORED));
        const groupQueue = groupBy(queue, 'pipelineName');
        this._groupActiveJobs = countBy(activePipelines, 'pipeline');
        const pipelinesNames = Object.keys(groupQueue);
        const storedPipelines = await persistence.getStoredPipelines({ pipelinesNames });
        this._pipelines = storedPipelines.filter(p => p.options && p.options.concurrentPipelines.rejectOnFailure === false);
        this._pipelines.forEach((p) => {
            const jobsByPipeline = this._groupActiveJobs[p.name] || 0;
            const queueByPipeline = groupQueue[p.name];
            const totalRunning = jobsByPipeline;
            const required = p.options.concurrentPipelines.amount - totalRunning;
            if (required > 0) {
                const maxExceeded = queueByPipeline.slice(0, required);
                maxExceeded.forEach((job) => {
                    canceledJobs += 1;
                    this._checkMaxExceeded({ experiment: job.experimentName, pipeline: job.pipelineName }, true);
                });
            }
        });
        return canceledJobs;
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
            const pipeline = await persistence.getExecution({ jobId });
            persistence.setJobStatus({ jobId, pipeline: pipeline.name, status, error, level: 'error' });
            persistence.setJobResults({ jobId, pipeline: pipeline.name, status, error, startTime: pipeline.startTime });
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
            const queue = queueRunner.queue.getQueue(q => !q.maxExceeded);
            if (queue.length > 0) {
                await this.createJob({ jobId: queue[0].jobId });
            }
        }
        catch (error) {
            log.throttle.error(error.message, { component }, error);
        }
    }

    _checkMaxExceeded({ experiment, pipeline }, increment) {
        const job = queueRunner.queue
            .getQueue(q => q.maxExceeded)
            .find(q => q.experimentName === experiment && q.pipelineName === pipeline);
        if (job) {
            if (this._checkRunningJobs(job)) {
                if (increment) {
                    job.updateRunning = 1;
                }
                this._cancelExceededJob({ job, experiment, pipeline });
            }
            else {
                this._updateActiveJobs(job);
            }
        }
    }

    _checkRunningJobs(job) {
        const active = this._groupActiveJobs[job.pipelineName];
        if (!active) {
            return true;
        }
        const max = this._pipelines.find(p => p.name === job.pipelineName).options.concurrentPipelines.amount;
        if (active >= max) {
            job.updateRunning = -1;
            return false;
        }
        return true;
    }

    _cancelExceededJob({ job, experiment, pipeline }) {
        log.info(`found and disable job with experiment ${experiment} and pipeline ${pipeline} that marked as maxExceeded`, { component });
        job.maxExceeded = false;
        if (this._isConsumerActive) {
            this._dequeueJob();
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

    // we only want to call done after finish with job
    async createJob({ jobId }) {
        const job = queueRunner.queue.dequeue(jobId);
        if (!job) {
            log.error(`trying to create job ${jobId} which is not exists in queue`, { component });
            return;
        }
        this._updateActiveJobs(job);

        log.debug(`creating new job ${jobId}, calculated score: ${job.score}`, { component });
        const jobData = this._pipelineToJob(job);
        await this._producer.createJob(jobData);
        job.done && job.done();
    }

    _updateActiveJobs(job) {
        if (job.updateRunning) {
            if (this._groupActiveJobs[job.pipelineName] > 0) {
                this._groupActiveJobs[job.pipelineName] += job.updateRunning;
                delete job.updateRunning;
            }
        }
    }
}

module.exports = new JobProducer();
