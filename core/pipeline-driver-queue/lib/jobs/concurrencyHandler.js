const groupBy = require('lodash.groupby');
const countBy = require('lodash.countby');
const log = require('@hkube/logger').GetLogFromContainer();
const { pipelineStatuses, pipelineTypes } = require('@hkube/consts');
const { componentName } = require('../consts');
const component = componentName.CONCURRENCY;
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');

class ConcurrencyHandler {
    constructor(producer, options) {
        this._groupActiveJobs = {};
        this._pipelines = [];
        this._producer = producer;
        this._checkConcurrencyJobsInterval = this._checkConcurrencyJobsInterval.bind(this);
        this._checkConcurrencyQueueInterval = options.checkConcurrencyQueueInterval;
    }

    startInterval() {
        this._checkConcurrencyJobsInterval();
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

    updateActiveJobs(job) {
        if (job.updateRunning) {
            if (this._groupActiveJobs[job.pipelineName] > 0) {
                this._groupActiveJobs[job.pipelineName] += job.updateRunning;
                delete job.updateRunning;
            }
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
        const queue = queueRunner.queue.getQueue();
        const queueMaxExceeded = queue.filter(q => q.maxExceeded);
        if (queueMaxExceeded.length === 0) {
            return canceledJobs;
        }
        const constNotMaxExceeded = queue.filter(q => !q.maxExceeded);
        const activeJobs = await persistence.getActiveJobs();
        const activePipelines = activeJobs.filter(r => r.status === pipelineStatuses.ACTIVE && r.types.includes(pipelineTypes.STORED));
        const groupQueueMaxExceeded = groupBy(queueMaxExceeded, 'pipelineName');
        const groupQueueNotMaxExceeded = countBy(constNotMaxExceeded, 'pipelineName');
        this._groupActiveJobs = countBy(activePipelines, 'pipeline');
        const pipelinesNames = Object.keys(groupQueueMaxExceeded);
        const storedPipelines = await persistence.getStoredPipelines({ pipelinesNames });
        this._pipelines = storedPipelines.filter(p => p.options && p.options.concurrentPipelines.rejectOnFailure === false);
        this._pipelines.forEach((p) => {
            const jobsByPipeline = this._groupActiveJobs[p.name] || 0;
            const queueByPipeline = groupQueueMaxExceeded[p.name];
            const waitingJobs = groupQueueNotMaxExceeded[p.name] || 0;
            const totalRunning = jobsByPipeline + waitingJobs;
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
                this.updateActiveJobs(job);
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
        this._producer.dequeueJob();
    }
}
module.exports = ConcurrencyHandler;
