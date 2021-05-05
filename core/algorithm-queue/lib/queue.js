const events = require('events');
const orderBy = require('lodash.orderby');
const remove = require('lodash.remove');
const asyncQueue = require('async.queue');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/component-name').QUEUE;
const queueEvents = require('./consts/queue-events');
const JobProducer = require('./jobs/producer');
const JobConsumer = require('./jobs/consumer');

class Queue extends events {
    constructor({ algorithmName, updateInterval, scoreHeuristic, enrichmentRunner, persistence }) {
        super();
        this.algorithmName = algorithmName;
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component });
        this.scoreHeuristic = scoreHeuristic;
        this.enrichmentRunner = enrichmentRunner;
        this.updateInterval = updateInterval;
        this.queue = [];
        this.isIntervalRunning = true;
        this.persistence = persistence;
        this._tasksQueue = asyncQueue((method, callback) => {
            method().then(r => callback(null, r))
                .catch(e => {
                    callback(e);
                });
        }, 1);
    }

    async start({ options, algorithmName }) {
        await this.persistencyLoad();
        this._queueInterval();

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
            getWaitingCount: (...args) => this._producer.getWaitingCount(...args),
            getWaitingJobs: (...args) => this._producer.getWaitingJobs(...args),
        });
        this._consumer.on('jobs-add', async (jobs) => {
            await this.addJobs(jobs);
        });
        this._consumer.on('jobs-remove', (jobs) => {
            this.removeJobs(jobs);
        });
    }

    stop() {
        this._producer.stop();
        this.isIntervalRunning = false;
        this.flush();
    }

    flush() {
        this.queue = [];
    }

    removeInvalidJob(data) {
        return this._consumer.removeInvalidJob(data);
    }

    removeInvalidTasks(data) {
        return this._consumer.removeInvalidTasks(data);
    }

    async persistencyLoad() {
        log.info('try to recover data from persistent storage', { component });
        if (this.persistence) {
            try {
                const queueItems = await this.persistence.get();
                await this.addJobs(queueItems);
                log.info('persistent added successfully', { component });
            }
            catch (e) {
                log.warning('could not add data from persistency ', { component });
            }
        }
        else {
            log.warning('persistency storage was not set ', { component });
        }
    }

    async persistenceStore() {
        log.debug('try to store data to  storage', { component });
        if (this.persistence) {
            const pendingAmount = await this._producer.getWaitingCount();
            await this.persistence.store({ data: this.queue, pendingAmount });
            log.debug('store data to storage succeed', { component });
        }
        else {
            log.warning('persistent storage not set', { component });
        }
    }

    async addJobs(data) {
        this._removeDuplicates(data);
        await this._asyncQueue(async () => this._addJobs(data));
    }

    _addJobs(data) {
        const tasks = data.map(task => this.scoreHeuristic(task));
        if (tasks.length === 0) {
            log.debug('there is no new inserted jobs', { component });
            return;
        }
        this.queue = [...this.queue, ...tasks];
        this._orderQueue();
        this.emit(queueEvents.INSERT, tasks);
        log.info(`${tasks.length} new jobs inserted to queue jobs`, { component });
    }

    async removeJobs(data) {
        await this._asyncQueue(async () => this._removeJobs(data));
    }

    _removeJobs(jobs) {
        if (jobs.length === 0) {
            log.debug('there is no deleted jobs', { component });
            return;
        }
        const removedTasks = [];
        jobs.forEach((j) => {
            // collect removed tasks to send in REMOVE event
            const tasks = remove(this.queue, t => (t.jobId === j.jobId) && (j.taskId ? t.taskId === j.taskId : true));
            removedTasks.push(...tasks);
        });
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

    getQueue() {
        return this.queue;
    }

    _orderQueue() {
        this.queue = orderBy(this.queue, j => j.calculated.score, 'desc');
    }

    // the interval logic should be as follows :
    // 1.if updateScore is running every new change entered to temp queue
    // 2. after each cycle merge with temp proceeded
    // 3. in case something is add when there is no running cycle each job inserted/ removed directly to the queue
    _queueInterval() {
        setTimeout(async () => {
            try {
                await this._pushQueueInterval();
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

    _pushQueueInterval() {
        return this._asyncQueue(async () => this._intervalUpdateCallback());
    }

    _asyncQueue(method) {
        return new Promise((resolve) => {
            this._tasksQueue.push(method, () => {
                return resolve();
            });
        });
    }

    async _intervalUpdateCallback() {
        this.enrichmentRunner(this.queue);
        this.updateScore();
        log.debug('queue update score cycle starts', { component });
        this._orderQueue();
        await this.persistenceStore();
    }
}

module.exports = Queue;
