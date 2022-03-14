const Events = require('events');
const orderby = require('lodash.orderby');
const remove = require('lodash.remove');
const log = require('@hkube/logger').GetLogFromContainer();
const concurrencyMap = require('./jobs/concurrency-map');
const { queueEvents, componentName } = require('./consts');
const component = componentName.QUEUE;

class Queue extends Events {
    constructor({ scoreHeuristic } = {}) {
        super();
        this.scoreHeuristic = scoreHeuristic;
        this.queue = [];
    }

    flush() {
        this.queue = [];
    }

    persistencyLoad(jobs, ordered) {
        if (ordered) {
            this._persistencyLoadOrdered(jobs);
        }
        else {
            this._persistencyLoad(jobs);
        }
    }

    _persistencyLoad(jobs) {
        const data = jobs.filter(job => job.next === undefined);
        if (data?.length > 0) {
            log.info(`recovering ${data.length} jobs from db`, { component });
            data.forEach(q => {
                concurrencyMap.checkConcurrencyLimit(q.pipeline);
                const job = this.pipelineToQueueAdapter({ jobId: q.jobId, pipeline: q.pipeline });
                this.enqueue(job);
            });
        }
    }

    _persistencyLoadOrdered(jobs) {
        const data = jobs.filter(job => job.next !== undefined);
        const orderedData = [];
        let previous = 'FirstInLine';
        data?.forEach(() => {
            const item = data.find(job => job.next === previous);
            if (item) {
                previous = item.jobId;
                orderedData.push(item);
            }
        });
        const filteredData = [];
        for (let i = 0; i < orderedData.length; i++) {
            const item = orderedData[i];
            const { jobId } = item;
            log.info(`getting recovery info for job ${jobId} loaded from persistency`, { component, jobId });
            const jobData = await dataStore.getJob({ jobId });
            const { status, pipeline } = jobData || {};
            let skip = false;
            if (!pipeline) {
                log.warning(`unable to find pipeline for job ${jobId} loaded from persistency`, { component, jobId });
                skip = true;
            }
            if (status && (status.status === pipelineStatuses.STOPPED || status.status === pipelineStatuses.PAUSED)) {
                log.warning(`job ${jobId} loaded from persistency with state stop therefore will not added to queue`, { component, jobId });
                skip = true;
            }
            if (!skip) {
                item.next = i === 0 ? 'FirstInLine' : orderedData[i - 1].jobId;
                filteredData.push(item);
            }
        }
        if (filteredData.length > 0) {
            filteredData.forEach(q => {
                const item = {
                    ...q,
                    calculated: {
                        latestScores: {}
                    }
                };
                if (staticOrder) {
                    this.queue.push(item);
                }
                else {
                    this.enqueue(item, true);
                }
            });
            log.info(`calculating heuristics for queue ${this._name} loaded from persistency`, { component });
            this._calculateHeuristic();
        }
        if (orderedData.length > 0) {
            orderedData.forEach(q => {
                concurrencyMap.checkConcurrencyLimit(q.pipeline);
                const job = this.pipelineToQueueAdapter({ jobId: q.jobId, score: 1, pipeline: q.pipeline });
                this.enqueue(job, { emitEvent: false, applyScore: false });
            });
        }
    }

    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    pipelineToQueueAdapter({ jobId, score, pipeline }) {
        return {
            jobId,
            experimentName: pipeline.experimentName,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            concurrency: pipeline.concurrency,
            entranceTime: Date.now(),
            tags: pipeline.tags || [],
            score,
            calculated: {
                latestScores: {}
            }
        };
    }

    _calculateHeuristic() {
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = orderby(this.queue, 'score', 'desc');
    }

    enqueue(job, skipHeuristic = false) {
        this.queue.push(job);
        if (!skipHeuristic) {
            this._calculateHeuristic();
        }
        this.emit(queueEvents.INSERT, job);
        log.info(`new job inserted to queue ${this._name}, queue size: ${this.size}`, { component });
    }

    dequeue(job) {
        const removedJob = remove(this.queue, j => j.jobId === job.jobId);
        if (removedJob.length > 0) {
            this.emit(queueEvents.POP, job);
            log.info(`job pop from queue ${this._name}, queue size: ${this.size}`, { component });
        }
        return removedJob;
    }

    remove(jobId) {
        const jobs = remove(this.queue, job => job.jobId === jobId);
        if (jobs.length > 0) {
            this.emit(queueEvents.REMOVE, jobs[0]);
            log.info(`job removed from queue ${this._name}, queue size: ${this.size}`, { component });
        }
        return jobs;
    }

    get size() {
        return this.queue.length;
    }

    getQueue(filter = () => true) {
        return this.queue.filter(filter);
    }

    getAvailableQueue() {
        return this.queue.filter(q => !q.concurrency?.limit);
    }

    getConcurrencyLimitQueue() {
        return this.queue.filter(q => q.concurrency?.limit);
    }
}

module.exports = Queue;
