const Events = require('events');
const _ = require('lodash');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/component-name').QUEUE;
const { queueEvents } = require('./consts');

class Queue extends Events {
    constructor({ scoreHeuristic = { run: null }, updateInterval = 1000, persistence = null } = {}) {
        super();
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component });
        this.scoreHeuristic = scoreHeuristic.run ? scoreHeuristic.run.bind(scoreHeuristic) : scoreHeuristic.run;
        this.updateInterval = updateInterval;
        this.queue = [];
        this.persistence = persistence;
        this.persistencyLoad();
    }

    async persistencyLoad() {
        if (!this.persistence) {
            return;
        }
        log.info('try to recover data from persistent storage', { component });
        try {
            const queueItems = await this.persistence.get();
            if (queueItems && queueItems.data && queueItems.data.length > 0) {
                queueItems.data.forEach(q => this.add(q));
                log.info('persistent added successfully', { component });
            }
            await this.persistenceStore({ pendingAmount: 0 });
        }
        catch (e) {
            log.error(`could not add data from persistency ${e.message}`, { component });
        }
    }

    async persistenceStore(data) {
        if (!this.persistence) {
            return;
        }
        log.debug('try to store data to storage', { component });
        try {
            await this.persistence.store({ data: this.queue, ...data });
            log.debug('store data to storage succeed', { component });
        }
        catch (e) {
            log.error(`fail to store data ${e.message}`, { component });
        }
    }

    // todo:add merge on async 
    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    add(job) {
        this.queue.push(job);
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = _.orderBy(this.queue, j => j.calculated.score, 'desc');
        this.emit(queueEvents.INSERT);
        log.info(`new job inserted to queue, queue size: ${this.queue.length}`, { component });
    }

    tryPop() {
        if (this.queue.length === 0) {
            return null;
        }
        const job = this.queue.shift();
        this.emit(queueEvents.POP, job.jobId);
        log.info(`job pop from queue, queue size: ${this.queue.length}`, { component });
        return job;
    }

    remove(jobId) {
        const jobs = _.remove(this.queue, job => job.jobId === jobId);
        if (jobs.length > 0) {
            this.emit(queueEvents.REMOVE, jobId);
            log.info(`job removed from queue, queue size: ${this.queue.length}`, { component });
        }
        return jobs;
    }

    get get() {
        return this.queue;
    }
}

module.exports = Queue;
