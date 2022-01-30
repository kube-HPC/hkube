const groupBy = require('lodash.groupby');
const countBy = require('lodash.countby');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts');
const component = componentName.CONCURRENCY;
const persistence = require('../persistency/persistence');
const queueRunner = require('../queue-runner');

class ConcurrencyHandler {
    constructor(producer, options) {
        this._regex = /pipeline-driver:pipeline-job:([^:]+)(?::cron|):([^:]+):([^:]+)$/;
        this._activeState = {};
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
            if (!this._activeState[job.pipelineName]) {
                this._activeState[job.pipelineName] = {};
            }
            this._activeState[job.pipelineName].count += job.updateRunning;
            log.info(`updating active jobs for ${job.pipelineName}: ${job.updateRunning}. now ${this._activeState[job.pipelineName].count}`, { component });
            job.updateRunning = 0;
        }
    }

    async getJobCountsFromRedis() {
        const redisClient = this._producer._redisQueue.client;
        const pipelineKeys = await redisClient.keys(`${this._producer.redisPrefix}:*`);
        const jobs = pipelineKeys.map(key => {
            const matches = key.match(this._regex);
            if (!matches?.length) {
                return null;
            }
            const job = {
                experiment: matches[1],
                pipeline: matches[2],
                jobId: matches[3]
            };
            if (pipelineKeys.includes(`${this._producer.redisPrefix}:${job.experiment}:${job.pipeline}:${job.jobId}:lock`)) {
                job.active = true;
            }
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
    async _checkConcurrencyJobs() {
        let canceledJobs = 0;
        const queue = queueRunner.queue.getQueue();
        const queueMaxExceeded = queue.filter(q => q.maxExceeded);
        if (queueMaxExceeded.length === 0) {
            return canceledJobs;
        }
        const activeJobs = await this.getJobCountsFromRedis();
        const groupQueueMaxExceeded = groupBy(queueMaxExceeded, 'pipelineName');
        const groupActiveJobs = activeJobs;
        const pipelinesNames = Object.keys(groupQueueMaxExceeded);
        const storedPipelines = await persistence.getStoredPipelines({ pipelinesNames });
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
                    this._checkMaxExceeded(job, true);
                });
            }
        });
        return canceledJobs;
    }

    _getWaitingCount() {
        return this._producer.getWaitingCount();
    }

    _checkMaxExceeded({ experimentName, pipelineName }, increment) {
        const job = queueRunner.queue
            .getQueue(q => q.maxExceeded)
            .find(q => q.experimentName === experimentName && q.pipelineName === pipelineName);
        this.cancelMaxExceededIfNeeded(job, increment);
    }

    cancelMaxExceededIfNeeded(job, increment) {
        if (job) {
            if (this._checkRunningJobs(job)) {
                if (increment) {
                    job.updateRunning = 1;
                }
                log.info(`removing maxExceeded for ${job.pipelineName} from ${increment ? 'interval' : 'event'}`, { component });

                this._cancelExceededJob({ job });
            }
            else {
                this.updateActiveJobs(job);
            }
        }
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
        const queueNotMaxExceeded = queueRunner.queue.getQueue(q => !q.maxExceeded);
        const groupQueueNotMaxExceeded = countBy(queueNotMaxExceeded, 'pipelineName');
        const waitingJobs = groupQueueNotMaxExceeded[job.pipelineName] || 0;
        const totalJobs = active + waitingJobs;
        if (totalJobs > max) {
            job.updateRunning = -1;
            log.info(`not adding job ${job.pipelineName}. max ${max}, active ${active}, totalJobs ${totalJobs}`, { component });
            return false;
        }
        return true;
    }

    _cancelExceededJob({ job }) {
        log.info(`cancel maxExceeded for ${job.jobId}`, { component });
        // NOT removing maxExceeded, but rather trying to dequeue the job
        // job.maxExceeded = false;
        this._producer.dequeueJob(job.jobId);
    }
}
module.exports = ConcurrencyHandler;
