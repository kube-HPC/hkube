const events = require('events');
const orderBy = require('lodash.orderby');
const remove = require('lodash.remove');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/component-name').QUEUE;
const queueEvents = require('./consts/queue-events');
const JobProducer = require('./jobs/producer');
const JobConsumer = require('./jobs/consumer');

class Queue extends events {
    constructor({ algorithmName, updateInterval, algorithmMinIdleTimeMS, scoreHeuristic, enrichmentRunner, persistence }) {
        super();
        this.algorithmName = algorithmName;
        this.scoreHeuristic = scoreHeuristic;
        this.enrichmentRunner = enrichmentRunner;
        this.updateInterval = updateInterval;
        this.queue = [];
        this.isIntervalRunning = true;
        this.persistence = persistence;
        this._lastActiveTime = Date.now();
        this._algorithmMinIdleTimeMS = algorithmMinIdleTimeMS;
    }

    async start({ options, algorithmName }) {
        this._producer = new JobProducer({
            options,
            algorithmName,
            getQueue: (...args) => this.getQueue(...args),
            addQueue: (...args) => this.addJobs(...args),
            tryPop: (...args) => this.tryPop(...args),
        });
        this._consumer = new JobConsumer({
            options,
            algorithmName,
            getWaitingJobs: (...args) => this._producer.getWaitingJobs(...args),
        });
        this._consumer.on('jobs-add', (jobs) => {
            this.addJobs(jobs);
        });
        this._consumer.on('jobs-remove', (jobs) => {
            this.removeJobs(jobs);
        });
        await this.persistencyLoad();
        this._queueInterval();
    }

    async stop(force) {
        if (!force && this.queue.length > 0) {
            log.warning('trying to stop active queue, request ignored', { component });
            return;
        }
        await this._producer.stop();
        await this._consumer.stop();
        this._producer = null;
        this._consumer = null;
        this.isIntervalRunning = false;
        this.flush();
    }

    async pause() {
        if (!this._isPaused) {
            this._isPaused = true;
            await this._consumer.pause();
        }
    }

    flush() {
        this.queue = [];
    }

    removeInvalidJob(data) {
        return this._consumer?.removeInvalidJob(data);
    }

    removeInvalidTasks(data) {
        return this._consumer?.removeInvalidTasks(data);
    }

    async persistencyLoad() {
        try {
            const queueItems = await this.persistence.get();
            this.addJobs(queueItems);
            log.info('persistent recovered successfully', { component });
        }
        catch (e) {
            log.warning('could not add data from persistency ', { component });
        }
    }

    async persistencyStore({ data, pendingAmount }) {
        await this.persistence.store({ data, pendingAmount });
    }

    addJobs(jobs) {
        if (!jobs?.length) {
            return;
        }
        this._lastActiveTime = Date.now();
        this._removeDuplicates(jobs);
        const tasks = jobs.map(task => this.scoreHeuristic(task));
        if (tasks.length === 0) {
            log.debug('there is no new inserted jobs', { component });
            return;
        }
        this.queue = [...this.queue, ...tasks];
        this._orderQueue();
        this.emit(queueEvents.INSERT, tasks);
        log.info(`${tasks.length} new jobs inserted, queue size: ${this.queue.length}`, { component });
    }

    removeJobs(jobs) {
        if (jobs.length === 0) {
            log.debug('there is no deleted jobs', { component });
            return;
        }
        const removedTasks = [];
        if (this.queue.length) {
            jobs.forEach((j) => {
                // collect removed tasks to send in REMOVE event
                const tasks = remove(this.queue, t => (t.jobId === j.jobId) && (j.taskId ? t.taskId === j.taskId : true));
                removedTasks.push(...tasks);
            });
        }
        if (removedTasks.length === 0) {
            return;
        }
        log.info(`${removedTasks.length} removed from queue`, { component });
        this.emit(queueEvents.REMOVE, removedTasks);
    }

    _removeDuplicates(tasks) {
        if (this.queue.length > 0) {
            tasks.forEach((t) => {
                const res = remove(this.queue, q => q.jobId === t.jobId && q.taskId === t.taskId && q.status === 'preschedule');
                res.forEach((r) => {
                    log.warning(`found duplicate task ${r.taskId} with status ${r.status}, new task status: ${t.status}`, { component });
                });
            });
        }
    }

    tryPop() {
        if (this.queue.length === 0) {
            return null;
        }
        const task = this.queue.shift();
        this.emit(queueEvents.POP, task);
        return task;
    }

    updateScore() {
        this.queue = this.queue.map(job => this.scoreHeuristic(job));
        this.emit(queueEvents.UPDATE_SCORE, this.queue);
    }

    get get() {
        return this.queue;
    }

    async checkIdle() {
        try {
            const isIdle = Date.now() - this._lastActiveTime > this._algorithmMinIdleTimeMS;
            const pendingAmount = await this._producer.getWaitingCount();
            const isEmpty = pendingAmount === 0 && this.queue.length === 0;
            this._isIdle = isIdle && isEmpty;
        }
        catch (e) {
            log.throttle.error(`error on checkIdle ${e.message}`, { component }, e);
        }
    }

    isIdle() {
        return this._isIdle;
    }

    isStaled() {
        return this._isIdle && this._isPaused;
    }

    getQueue() {
        return this.queue;
    }

    _orderQueue() {
        this.queue = orderBy(this.queue, j => j.calculated.score, 'desc');
    }

    _queueInterval() {
        setTimeout(async () => {
            try {
                await this._intervalUpdateCallback();
            }
            catch (error) {
                log.throttle.error(`fail on queue interval ${error}`, { component }, error);
            }
            finally {
                if (this.isIntervalRunning) {
                    this._queueInterval();
                }
            }
        }, this.updateInterval);
    }

    async _intervalUpdateCallback() {
        if (!this._producer) {
            return;
        }
        const pendingAmount = await this._producer.getWaitingCount();
        this.enrichmentRunner(this.queue);
        this.updateScore();
        log.debug('queue update score cycle starts', { component });
        this._orderQueue();
        await this.persistencyStore({ data: this.queue, pendingAmount });
    }
}

module.exports = Queue;
