/* eslint-disable no-param-reassign */
const groupBy = require('lodash.groupby');
const countBy = require('lodash.countby');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts');
const component = componentName.CONCURRENCY;
const dataStore = require('../persistency/data-store');
const queueRunner = require('../queue-runner');

class ConcurrencyHandler {
    constructor(producer, options) {
        this._activeState = {};
        this._producer = producer;
        this._checkConcurrencyJobsInterval = this._checkConcurrencyJobsInterval.bind(this);
        this._checkConcurrencyQueueInterval = options.checkConcurrencyQueueInterval;
    }

    startInterval() {
        this._checkConcurrencyJobsInterval();
    }

    _queueHasEligibleJobs(queue) {
        return queue.getQueue(q => !q.maxExceeded).length > 0;
    }

    async _checkConcurrencyJobsInternal() {
        let totalCanceledJobs = 0;
        for (const queue of queueRunner.queues) {
            totalCanceledJobs += await this._checkConcurrencyJobs(queue);
            if (totalCanceledJobs > 0 || this._queueHasEligibleJobs(queue)) {
                break;
            }
        }
        return totalCanceledJobs;
    }

    async _checkConcurrencyJobsInterval() {
        try {
            await this._checkConcurrencyJobsInternal();
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
            if (!this._activeState[job.pipelineName]) {
                this._activeState[job.pipelineName] = {};
            }
            this._activeState[job.pipelineName].count += job.updateRunning;
            log.info(`updating active jobs for ${job.pipelineName}: ${job.updateRunning}. now ${this._activeState[job.pipelineName].count}`, { component });
            job.updateRunning = 0;
        }
    }

    async getJobCountsFromRedis() {
        const pipelineKeys = await this._producer._redisQueue.getJobs();
        const jobs = pipelineKeys.map(key => {
            const job = {
                experiment: key.data.experiment,
                pipeline: key.data.pipeline,
                jobId: key.data.jobId,
            };
            return job;
        }).filter(job => !!job);
        const jobCounts = countBy(jobs, 'pipeline');
        return jobCounts;
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
    async _checkConcurrencyJobs(queue) {
        let canceledJobs = 0;
        const queueMaxExceeded = queue.getQueue(q => q.maxExceeded);
        if (queueMaxExceeded.length === 0) {
            return canceledJobs;
        }
        const activeJobs = await this.getJobCountsFromRedis();
        const groupQueueMaxExceeded = groupBy(queueMaxExceeded, 'pipelineName');
        const groupActiveJobs = activeJobs;
        const pipelinesNames = Object.keys(groupQueueMaxExceeded);
        const storedPipelines = await dataStore.getStoredPipelines({ pipelinesNames });
        const pipelines = storedPipelines.filter(p => p.options && p.options.concurrentPipelines.rejectOnFailure === false);
        pipelines.forEach(pipeline => {
            this._activeState[pipeline.name] = {
                name: pipeline.name,
                count: groupActiveJobs[pipeline.name] || 0,
                max: pipelines.find(p => p.name === pipeline.name)?.options?.concurrentPipelines?.amount || 0
            };
        });
        pipelines.forEach((p) => {
            const jobsByPipeline = this._activeState[p.name]?.count || 0;
            const max = this._activeState[p.name]?.max || 0;
            const queueByPipeline = groupQueueMaxExceeded[p.name];
            const required = max - jobsByPipeline;
            log.info(`${p.name} has ${jobsByPipeline} active jobs and ${queueByPipeline.length} maxExceeded jobs. max ${max}`, { component });
            if (required > 0) {
                log.info(`need to add ${required} for ${p.name}. active: ${jobsByPipeline}, max: ${max}`, { component });
                const maxExceeded = queueByPipeline.slice(0, 1);
                maxExceeded.forEach((job) => {
                    canceledJobs += 1;
                    this._checkMaxExceeded(job, true, queue);
                });
            }
        });
        return canceledJobs;
    }

    _getWaitingCount() {
        return this._producer.getWaitingCount();
    }

    _checkMaxExceeded({ experimentName, pipelineName }, increment, queue) {
        const job = queue
            .getQueue(q => q.maxExceeded)
            .find(q => q.experimentName === experimentName && q.pipelineName === pipelineName);
        const ret = this.cancelMaxExceededIfNeeded(job, increment);
        return ret;
    }

    checkMaxExceeded({ experimentName, pipelineName }, increment) {
        if (this._checkMaxExceeded({ experimentName, pipelineName }, increment, queueRunner.preferredQueue)) {
            return;
        }
        this._checkMaxExceeded({ experimentName, pipelineName }, increment, queueRunner.queue);
    }

    cancelMaxExceededIfNeeded(job, increment) {
        let ret = false;
        if (job) {
            if (this._checkRunningJobs(job)) {
                if (increment) {
                    job.updateRunning = 1;
                }
                log.info(`removing maxExceeded for ${job.pipelineName} from ${increment ? 'interval' : 'event'}`, { component });
                ret = true;
                this._cancelExceededJob({ job });
            }
            else {
                this.updateActiveJobs(job);
            }
        }
        return ret;
    }

    _checkRunningJobs(job) {
        const active = this._activeState[job.pipelineName]?.count;
        if (!active) {
            return true;
        }
        const max = this._activeState[job.pipelineName]?.max;
        if (!max) {
            return true;
        }
        const waitingJobs = this._getWaitingJobsFromQueue(job, queueRunner.queue);
        const waitingJobsPreferred = this._getWaitingJobsFromQueue(job, queueRunner.preferredQueue);
        const totalJobs = active + waitingJobs + waitingJobsPreferred;
        if (totalJobs > max) {
            job.updateRunning = -1;
            log.info(`not adding job ${job.pipelineName}. max ${max}, active ${active}, totalJobs ${totalJobs}`, { component });
            return false;
        }
        return true;
    }

    _getWaitingJobsFromQueue(job, queue) {
        const queueNotMaxExceeded = queue.getQueue(q => !q.maxExceeded);
        const groupQueueNotMaxExceeded = countBy(queueNotMaxExceeded, 'pipelineName');
        const waitingJobs = groupQueueNotMaxExceeded[job.pipelineName] || 0;
        return waitingJobs;
    }

    _cancelExceededJob({ job }) {
        log.info(`cancel maxExceeded for ${job.jobId}`, { component });
        // NOT removing maxExceeded, but rather trying to dequeue the job
        // job.maxExceeded = false;
        this._producer.dequeueJob(job.jobId);
    }
}
module.exports = ConcurrencyHandler;
