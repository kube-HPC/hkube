const Events = require('events');
const orderby = require('lodash.orderby');
const remove = require('lodash.remove');
const log = require('@hkube/logger').GetLogFromContainer();
const { queueEvents, componentName } = require('./consts');
const component = componentName.QUEUE;

class Queue extends Events {
    constructor({ scoreHeuristic = { run: null }, persistence = null } = {}) {
        super();
        this.scoreHeuristic = scoreHeuristic.run ? scoreHeuristic.run.bind(scoreHeuristic) : scoreHeuristic.run;
        this.queue = [];
        this.isIntervalRunning = true;
        this.persistence = persistence;
    }

    flush() {
        this.queue = [];
    }

    async persistencyLoad() {
        if (!this.persistence) {
            return;
        }
        log.info('try to load data from persistent storage', { component });
        try {
            const queueItems = await this.persistence.get();
            if (queueItems && queueItems.data && queueItems.data.length > 0) {
                queueItems.data.forEach(q => this.enqueue(q));
            }
            log.info('successfully load data from persistent storage', { component });
        }
        catch (e) {
            log.error(`failed to load data from persistent storage, ${e.message}`, { component }, e);
        }
    }

    async persistenceStore(data) {
        if (!this.persistence) {
            return;
        }
        log.debug('try to store data to persistent storage', { component });
        try {
            await this.persistence.store(data);
            log.debug('successfully store data to storage', { component });
        }
        catch (e) {
            log.error(`failed to store data to persistent storage, ${e.message}`, { component }, e);
        }
    }

    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    enqueue(job) {
        this.queue.push(job);
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = orderby(this.queue, ['maxExceeded', 'score'], ['asc', 'desc']);
        const jobQ = this.queue.find(j => j.jobId === job.jobId);
        this.emit(queueEvents.INSERT, jobQ);
        this.emit(queueEvents.UPDATE_SCORE, jobQ);
        log.info(`new job inserted to queue, queue size: ${this.size}`, { component });
    }

    dequeue() {
        const job = this.queue.shift();
        this.emit(queueEvents.POP, job);
        log.info(`job pop from queue, queue size: ${this.size}`, { component });
        return job;
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

    set intervalRunningStatus(status) {
        this.isIntervalRunning = status;
    }
}

module.exports = Queue;
