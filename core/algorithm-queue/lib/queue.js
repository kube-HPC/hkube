const log = require('@hkube/logger').GetLogFromContainer();
const components = require('./consts/component-name');
const _ = require('lodash');
const aigle = require('aigle');
const events = require('events');
const queueEvents = require('./consts/queue-events');

// const./consts/queue-events = {
//     jobID: 'uuid',
//     pipelineName: 'id',
//     priority: '1-5',
//     algorithmName: 'alg name',
//     taskId:'uuid'
//     batchPlace: '0-n',
//     options:{}
// taskData: {
//     input: task.input
// },
//     calculated: {
//         score: '1-100',
//         latestScores: {},
//         entranceTime: 'date',
//     }// const./consts/queue-events = {
// } };


class Queue extends events {
    constructor({ scoreHeuristic = {run: null}, updateInterval = 1000, persistence = null, enrichmentRunner = {run: null} } = {}) {
        super();
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component: components.QUEUE});
        aigle.mixin(_);
        //  this._heuristicRunner = scoreHeuristic;
        // handle empty heuristic on constructor
        this.scoreHeuristic = scoreHeuristic.run ? scoreHeuristic.run.bind(scoreHeuristic) : scoreHeuristic.run;
        this.enrichmentRunner = enrichmentRunner.run ? enrichmentRunner.run.bind(enrichmentRunner) : enrichmentRunner.run;
        //    this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
        this.updateInterval = updateInterval;
        this.queue = [];
        this.isScoreDuringUpdate = false;
        this.tempInsertQueue = [];
        this.tempRemoveQueue = [];
        this.isIntervalRunning = true;
        this.persistence = persistence;
        this.persistencyLoad();
        this._queueInterval();
    }
    flush() {
        this.queue = [];
        this.tempInsertQueue = [];
        this.tempRemoveQueue = [];
    }
    async persistencyLoad() {
        log.info('try to recover data from persistent storage', { component: components.QUEUE});
        if (this.persistence) {
            try {
                const queueItems = await this.persistence.get();
                await this.add(queueItems);
                log.info('persistent added sucessfully', { component: components.QUEUE});
            }
            catch (e) {
                log.warning('could not add data from persistency ', { component: components.QUEUE});                
            }
        }
        else {
            log.warning('persistency storage was not set ', { component: components.QUEUE});
        }
    }
    async persistenceStore() {
        log.debug('try to store data to  storage', { component: components.QUEUE});
        if (this.persistence) {
            try {
                await this.persistence.store(this.queue);
                log.debug('store data to storage succeed', { component: components.QUEUE});
            }
            catch (e) {
                log.warning('fail to store data', { component: components.QUEUE});
            } 
        }
        else {
            log.warning('persistent storage not set', {component: components.QUEUE});
        }
    }
    // todo:add merge on async 
    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
        //   this.scoreHeuristic = heuristic.run.bind(heuristic);
    }
    async add(jobs) {
        if (this.scoreHeuristic) {
            const calculatedJobs = await aigle.map(jobs, job => this.scoreHeuristic(job));
            if (this.isScoreDuringUpdate) {
                log.debug('add -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE});
                this.tempInsertQueue = this.tempInsertQueue.concat(calculatedJobs);
                return;
            }
            this._insert(calculatedJobs);
        }
        else {
            log.warning('score heuristic is not defined', { component: components.QUEUE});
        }
    }
    tryPop() {
        if (this.queue.length === 0) {
            return null;
        }
        const job = this.queue.shift();
        this.remove([job.taskId]);
        this.emit(queueEvents.POP, {taskId: job.taskId});
        return job;
    }
    removeJobId(jobsId) {
        if (this.isScoreDuringUpdate) {
            log.debug('remove -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE});
            this.tempRemoveQueue = this.tempRemoveQueue.concat(jobsId);
            return;
        }
        this._removeJobId(jobsId);
    }

    remove(taskId) {
        if (this.isScoreDuringUpdate) {
            log.debug('remove -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE});
            this.tempRemoveQueue = this.tempRemoveQueue.concat(taskId);
            return;
        }
        this._remove(taskId);
    }
    async updateScore() {
        this.queue = await aigle.map(this.queue, job => this.scoreHeuristic(job));
        this.emit(queueEvents.UPDATE_SCORE, this.queue);
    }
  
    
    get get() {
        return this.queue;
    }
    set intervalRunningStatus(status) {
        this.isIntervalRunning = status;
    }
    _insert(jobArr) {
        if (jobArr.length === 0) {
            log.debug('there is no new inserted jobs', { component: components.QUEUE});
            return; 
        }
        this.queue = _.orderBy([...this.queue, ...jobArr], j => j.calculated.score, 'desc');
        this.emit(queueEvents.INSERT);
        log.info(`new jobs inserted to queue jobs:${jobArr}`, { component: components.QUEUE});
    }

    _removeJobID(jobArr) {
        if (jobArr.length === 0) {
            log.debug('there is no deleted jobs', { component: components.QUEUE});
            return; 
        }
        log.info(`${[...jobArr]} removed from queue  `, { component: components.QUEUE});
        jobArr.forEach((jobID) => {
            _.remove(this.queue, job => job.jobID === jobID);
        });
        this.emit(queueEvents.REMOVE, jobArr);
    }
    _remove(taskArr) {
        if (taskArr.length === 0) {
            log.debug('there is no deleted jobs', { component: components.QUEUE});
            return; 
        }
        log.info(`${[...taskArr]} removed from queue  `, { component: components.QUEUE});
        taskArr.forEach((jobID) => {
            _.remove(this.queue, job => job.jobID === jobID);
        });
        this.emit(queueEvents.REMOVE, taskArr);
    }


    // should be merged after each interval cycle
    _mergeTemp() {
        this._insert(this.tempInsertQueue);
        this._remove(this.tempRemoveQueue);
        this.tempInsertQueue = [];
        this.tempRemoveQueue = [];
    }
    // the interval logic should be as follows :
    // 1.if updateScore is running every new change entered to temp queue
    // 2. after each cycle merge with temp proceeded 
    // 3. in case something is add when there is no running cycle each job inserted/ removed directly to the queue
    _queueInterval() {
        setTimeout(async () => {
            this.isScoreDuringUpdate = true;
            await this.enrichmentRunner(this.queue);
            await this.updateScore();
            log.debug('queue update score cycle starts', { component: components.QUEUE});
            this._mergeTemp();
            await this.persistenceStore();
            this.isScoreDuringUpdate = false;
            if (this.isIntervalRunning) {
                this._queueInterval();
            }
        }, this.updateInterval);
    }
}


module.exports = Queue;
