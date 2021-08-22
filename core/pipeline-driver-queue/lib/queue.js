const Events = require('events');
const orderby = require('lodash.orderby');
const remove = require('lodash.remove');
const log = require('@hkube/logger').GetLogFromContainer();
const { queueEvents, componentName } = require('./consts');
const component = componentName.QUEUE;

class Queue extends Events {
    constructor({ scoreHeuristic, persistency } = {}) {
        super();
        this.scoreHeuristic = scoreHeuristic;
        this.queue = [];
        this._active = true;
        this._persistency = persistency;
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

    async persistencyLoad() {
        if (!this._persistency) {
            return;
        }
        const data = await this._persistency.get();
        if (data?.length > 0) {
            data.forEach(q => {
                const item = {
                    ...q,
                    calculated: {
                        latestScores: {}
                    }
                };
                this.enqueue(item);
            });
        }
    }

    async persistenceStore(data) {
        if (!this._persistency || !data) {
            return;
        }
        const mapData = data.map(q => {
            const { calculated, ...rest } = q;
            return rest;
        });
        await this._persistency.store(mapData);
    }

    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    enqueue(job) {
        this.queue.push(job);
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = orderby(this.queue, 'score', 'desc');
        this.emit(queueEvents.INSERT, job);
        log.info(`new job inserted to queue, queue size: ${this.size}`, { component });
    }

    dequeue(job) {
        remove(this.queue, j => j.jobId === job.jobId);
        this.emit(queueEvents.POP, job);
        log.info(`job pop from queue, queue size: ${this.size}`, { component });
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
