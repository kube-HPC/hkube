const events = require('events');
const orderBy = require('lodash.orderby');
const remove = require('lodash.remove');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('./consts/component-name');
const queueEvents = require('./consts/queue-events');
const JobProducer = require('./jobs/producer');
const JobConsumer = require('./jobs/consumer');

class Queue extends events {
    constructor({ scoreHeuristic = { run: null }, updateInterval = 1000, persistence = null, enrichmentRunner = { run: null } } = {}) {
        super();
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component: components.QUEUE });
        this.scoreHeuristic = scoreHeuristic.run ? scoreHeuristic.run.bind(scoreHeuristic) : scoreHeuristic.run;
        this.enrichmentRunner = enrichmentRunner.run ? enrichmentRunner.run.bind(enrichmentRunner) : enrichmentRunner.run;
        this.updateInterval = updateInterval;
        this.queue = [];
        this.isScoreDuringUpdate = false;
        this.tempInsertTasksQueue = [];
        this.tempRemoveJobIDsQueue = [];
        this.isIntervalRunning = true;
        this.persistence = persistence;
    }

    async start({ options, algorithmName }) {
        await this.persistencyLoad();
        this._queueInterval();

        this._producer = new JobProducer({
            producerUpdateInterval: options.producerUpdateInterval,
            algorithmName,
            getQueue: (...args) => this.getQueue(...args),
            addQueue: (...args) => this.add(...args),
            tryPop: (...args) => this.tryPop(...args),
        });
        this._producer.start();

        this._consumer = new JobConsumer({
            algorithmName,
            getWaitingCount: (...args) => this._producer.getWaitingCount(...args),
            getWaitingJobs: (...args) => this._producer.getWaitingJobs(...args),
            ...options,
        });
        this._consumer.on('jobs-add', (jobs) => {
            this.add(jobs);
        });
        this._consumer.on('jobs-remove', (jobs) => {
            this.removeJobs(jobs);
        });
        this._consumer.init();
    }

    stop() {
        this._producer.stop();
        this.isIntervalRunning = false;
        this.flush();
    }

    flush() {
        this.queue = [];
        this.tempInsertTasksQueue = [];
        this.tempRemoveJobIDsQueue = [];
    }

    removeInvalidJob(data) {
        return this._consumer.removeInvalidJob(data);
    }

    removeInvalidTasks(data) {
        return this._consumer.removeInvalidTasks(data);
    }

    async persistencyLoad() {
        log.info('try to recover data from persistent storage', { component: components.QUEUE });
        if (this.persistence) {
            try {
                const queueItems = await this.persistence.get();
                this.add(queueItems);
                log.info('persistent added successfully', { component: components.QUEUE });
            }
            catch (e) {
                log.warning('could not add data from persistency ', { component: components.QUEUE });
            }
        }
        else {
            log.warning('persistency storage was not set ', { component: components.QUEUE });
        }
    }

    async persistenceStore() {
        log.debug('try to store data to  storage', { component: components.QUEUE });
        if (this.persistence) {
            const pendingAmount = await this._producer.getWaitingCount();
            await this.persistence.store({ data: this.queue, pendingAmount });
            log.debug('store data to storage succeed', { component: components.QUEUE });
        }
        else {
            log.warning('persistent storage not set', { component: components.QUEUE });
        }
    }

    // todo:add merge on async
    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    add(tasks) {
        this._removeDuplicates(tasks);
        if (this.scoreHeuristic) {
            const calculatedTasks = tasks.map(task => this.scoreHeuristic(task));
            if (this.isScoreDuringUpdate) {
                log.debug('add -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE });
                this.tempInsertTasksQueue = this.tempInsertTasksQueue.concat(calculatedTasks);
                return;
            }
            this._insert(calculatedTasks);
        }
        else {
            log.warning('score heuristic is not defined', { component: components.QUEUE });
        }
    }

    _removeDuplicates(tasks) {
        if (this.queue.length > 0) {
            tasks.forEach((t) => {
                const res = remove(this.queue, q => q.jobId === t.jobId && q.taskId === t.taskId && q.status === 'preschedule');
                res.forEach((r) => {
                    log.warning(`found duplicate task ${r.taskId} with status ${r.status}, new task status: ${t.status}`, { component: components.QUEUE });
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

    removeJobs(jobs) {
        if (this.isScoreDuringUpdate) {
            log.debug('remove -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE });
            this.tempRemoveJobIDsQueue.push(...jobs);
            return;
        }
        this._removeJobs(jobs);
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

    set intervalRunningStatus(status) {
        this.isIntervalRunning = status;
    }

    _insert(taskArr) {
        if (taskArr.length === 0) {
            log.debug('there is no new inserted jobs', { component: components.QUEUE });
            return;
        }
        this.queue = orderBy([...this.queue, ...taskArr], j => j.calculated.score, 'desc');
        this.emit(queueEvents.INSERT, taskArr);
        log.info(`${taskArr.length} new jobs inserted to queue jobs`, { component: components.QUEUE });
    }

    _orderQueue() {
        this.queue = orderBy([...this.queue], j => j.calculated.score, 'desc');
    }

    _removeJobs(jobs) {
        if (jobs.length === 0) {
            log.debug('there is no deleted jobs', { component: components.QUEUE });
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
        log.info(`${removedTasks.length} removed from queue`, { component: components.QUEUE });
        this.emit(queueEvents.REMOVE, removedTasks);
    }

    // should be merged after each interval cycle
    _mergeTemp() {
        this._insert(this.tempInsertTasksQueue);
        this._removeJobs(this.tempRemoveJobIDsQueue);
        this.tempInsertTasksQueue = [];
        this.tempRemoveJobIDsQueue = [];
    }

    // the interval logic should be as follows :
    // 1.if updateScore is running every new change entered to temp queue
    // 2. after each cycle merge with temp proceeded
    // 3. in case something is add when there is no running cycle each job inserted/ removed directly to the queue
    _queueInterval() {
        setTimeout(async () => {
            try {
                await this._intervalUpdateCallback();
            }
            catch (error) {
                log.throttle.error(`fail on queue interval ${error}`, { component: components.QUEUE }, error);
            }
            finally {
                if (this.isIntervalRunning) {
                    this._queueInterval();
                }
            }
        }, this.updateInterval);
    }

    async _intervalUpdateCallback() {
        this.isScoreDuringUpdate = true;
        await this.enrichmentRunner(this.queue);
        this.updateScore();
        log.debug('queue update score cycle starts', { component: components.QUEUE });
        this._mergeTemp();
        this._orderQueue();
        await this.persistenceStore();
        this.isScoreDuringUpdate = false;
    }
}

module.exports = Queue;
