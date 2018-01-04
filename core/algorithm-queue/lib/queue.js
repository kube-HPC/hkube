const log = require('@hkube/logger').GetLogFromContainer();
const components = require('./consts/component-name');
const _ = require('lodash');
const aigle = require('aigle');
const events = require('events');
const queueEvents = require('./consts/queue-events');
// const./consts/queue-events = {
//     jobId: 'uuid',
//     pipelineName: 'id',
//     priority: '1-5',
//     algorithmName: 'alg name',
//     batchPlace: '0-n',
//     calculated: {
//         score: '1-100',
//         entranceTime: 'date',
//     }
// };

class Queue extends events {
    constructor({ scoreHeuristic = null, updateInterval = 1000 } = {}) {
        super();
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component: components.QUEUE});
        aigle.mixin(_);
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
        this.updateInterval = updateInterval;
        this.queue = [];
        this.isScoreDuringUpdate = false;
        this.tempInsertQueue = [];
        this.tempRemoveQueue = [];
        this.isIntervalRunning = true;
        this._queueInterval();
    }
    // todo:add merge on async 
    updateHeuristic(heuristic) {
        this.scoreHeuristic = heuristic.bind(heuristic);
    }
    async add(jobs) {
        const calculatedJobs = await aigle.map(jobs, job => this.scoreHeuristic(job));
        if (this.isScoreDuringUpdate) {
            log.debug('add -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE});
            this.tempInsertQueue = this.tempInsertQueue.concat(calculatedJobs);
            return;
        }
        this._insert(calculatedJobs);
    }
    pop() {
        const job = this.queue.shift();
        this.remove([job.jobId]);
        this.emit(queueEvents.POP, {jobId: job.jobId});
        return job;
    }
    remove(jobsId) {
        if (this.isScoreDuringUpdate) {
            log.debug('remove -  score is currently updated so the remove is added to the temp arr ', { component: components.QUEUE});
            this.tempRemoveQueue = this.tempRemoveQueue.concat(jobsId);
            return;
        }
        this._remove(jobsId);
    }
    async updateScore() {
        this.queue = await aigle.map(this.queue, job => this.scoreHeuristic(job));
    }
    // todo: add persistency to redis 
    async persistence() {
        return null;  
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
        this.queue = _.orderBy([...this.queue, ...jobArr], j => j.calculated, 'desc');
        this.emit(queueEvents.INSERT);
        log.info(`new jobs inserted to queue jobs:${jobArr}`, { component: components.QUEUE});
    }

    _remove(jobArr) {
        if (jobArr.length === 0) {
            log.debug('there is no deleted jobs', { component: components.QUEUE});
            return; 
        }
        log.info(`${[...jobArr]} removed from queue  `, { component: components.QUEUE});
        jobArr.forEach((jobId) => {
            _.remove(this.queue, job => job.jobId === jobId);
        });
        this.emit(queueEvents.REMOVE, jobArr);
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
            await this.updateScore();
            log.debug('queue update score cycle starts', { component: components.QUEUE});
            this._mergeTemp();
            this.isScoreDuringUpdate = false;
            if (this.isIntervalRunning) {
                this._queueInterval();
            }
        }, this.updateInterval);
    }
}


module.exports = Queue;
