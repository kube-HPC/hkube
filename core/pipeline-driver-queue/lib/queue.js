/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
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

    async _persistencyLoadOrdered(jobs) {
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
        if (orderedData.length > 0) {
            orderedData.forEach(q => {
                concurrencyMap.checkConcurrencyLimit(q.pipeline);
                const job = this.pipelineToQueueAdapter({ jobId: q.jobId, score: 1, pipeline: q.pipeline });
                this.enqueue(job, { emitEvent: false, applyScore: false });
            });
        }
        this.calculateHeuristic();
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
            this.calculateHeuristic();
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

    get name() {
        return this._name;
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
