const Events = require('events');
const orderby = require('lodash.orderby');
const remove = require('lodash.remove');
const { pipelineStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { queueEvents, componentName } = require('./consts');
const component = componentName.QUEUE;

class Queue extends Events {
    constructor({ scoreHeuristic, persistency, name } = {}) {
        super();
        this.scoreHeuristic = scoreHeuristic;
        this.queue = [];
        this._active = true;
        this._persistency = persistency;
        this._name = name;
    }

    flush() {
        this.queue = [];
    }

    async shutdown() {
        this._active = false;
        await this.pause();
        const pendingAmount = await this._producer.getWaitingCount();
        await this.persistencyStore({ data: this.queue, pendingAmount });
    }

    async persistencyLoad(ordered) {
        if (!this._persistency) {
            return;
        }
        if (!ordered) {
            const data = await this._persistency.getJobs({ status: pipelineStatuses.QUEUED }).filter(job => {
                return job.next === undefined;
            });
            if (data?.length > 0) {
                log.info(`recovering ${data.length} jobs from db`, { component });
                data.forEach(q => {
                    this.enqueue({ jobId: q.jobId, pipeline: q.pipeline });
                });
            }
        }
        else {
            const data = await this._persistency.getJobs({ status: pipelineStatuses.QUEUED }).filter(job => {
                return job.next !== undefined;
            });
            const orderedData = [];
            let previous = 'FirstInLine';
            data?.forEach(() => {
                const item = data.find(job => job.next === previous);
                previous = item.jobId;
                orderedData.push(item);
            });

            if (orderedData.length > 0) {
                orderedData.forEach(q => {
                    const item = {
                        ...q,
                        score: 1,
                        calculated: {
                            latestScores: {}
                        }
                    };
                    this.queue.push(item);
                });
            }
        }
    }

    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    _pipelineToQueueAdapter({ jobId, score, pipeline }) {
        return {
            jobId,
            experimentName: pipeline.experimentName,
            pipelineName: pipeline.name,
            priority: pipeline.priority,
            maxExceeded: pipeline.maxExceeded,
            entranceTime: Date.now(),
            score,
            calculated: {
                latestScores: {}
            }
        };
    }

    enqueue({ jobId, score, pipeline }) {
        const job = this._pipelineToQueueAdapter({ jobId, score, pipeline });
        this.queue.push(job);
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = orderby(this.queue, 'score', 'desc');
        this.emit(queueEvents.INSERT, job);
        log.info(`new job inserted to queue, queue size: ${this.size}`, { component });
    }

    dequeue(job) {
        const removedJob = remove(this.queue, j => j.jobId === job.jobId);
        if (removedJob.length > 0) {
            this.emit(queueEvents.POP, job);
            log.info(`job pop from queue, queue size: ${this.size}`, { component });
        }
        return removedJob;
    }

    remove(jobId) {
        const jobs = remove(this.queue, job => job.jobId === jobId);
        if (jobs.length > 0) {
            this.emit(queueEvents.REMOVE, jobs[0]);
            log.info(`job removed from queue, queue size: ${this.size}`, { component });
        }
        return jobs;
    }

    get size() {
        return this.queue.length;
    }

    getQueue(filter = () => true) {
        return this.queue.filter(filter);
    }
}

module.exports = Queue;
