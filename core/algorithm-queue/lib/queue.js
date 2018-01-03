const log = require('@hkube/logger').GetLogFromContainer();
const components = require('./consts/component-name');
const _ = require('lodash');
const aigle = require('aigle');
const events = require('events');
const queueEvents = require('./consts/queue-events');
// const./consts/queue-events = {
//     jobId: 'uuid',
//     pipelineName: 'id',
//     proirity: '1-5',
//     algorithmName: 'alg name',
//     batchPlace: '0-n',
//     calculated: {
//         score: '1-100',
//         enternceTime: 'date',
//     }
// };

class Queue extends events {
    constructor({ scoreHeuristic = null, updateInterval = 1000 } = {}) {
        super();
        log.info(`new queue created with the following params updateInterval: ${updateInterval}`, { component: components.QUEUE});
        aigle.mixin(_);
        this.scoreHeuristic = scoreHeuristic;
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
        this.scoreHeuristic = heuristic;
    }
    async add(jobs) {
        console.log('add called');
        const calclulatedJobs = await aigle.map(jobs, job => this.scoreHeuristic(job));
        if (this.isScoreDuringUpdate) {
            this.tempInsertQueue = this.tempInsertQueue.concat(calclulatedJobs);
            return;
        }
        this._insert(calclulatedJobs);
    }
    pop() {
        const job = this.queue.shift();
        this.remove(job.jobsId);
    }
    remove(jobsId) {
        if (this.isScoreDuringUpdate) {
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
        this.isIntervalRunning = false;
    }
    _insert(jobArr) {
        this.queue = _.orderBy([...this.queue, ...jobArr], j => j.calculated.score, 'desc');
        this.emit(queueEvents.INSERT);
        log.info(`new jobs inserted to queue jobs:${jobArr}`, { component: components.QUEUE});
        console.log('inserted queue', this.queue);
    }

    _remove(jobArr) {
        jobArr.forEach(jobId => _.remove(this.queue, job => job.jobId === jobId));
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
    // 2. after each cycle merge with temp proccedded 
    // 3. in case something is add when there is no running cycle each job inseted/ removed dircetly to the queue
    _queueInterval() {
        setTimeout(async () => {
            console.log('update score started');
            this.isScoreDuringUpdate = true;
            await this.updateScore();
            console.log('update score finished');
            this._mergeTemp();
            this.isScoreDuringUpdate = false;
            if (this.isIntervalRunning) {
                this._queueInterval();
            }
        }, this.updateInterval);
    }
}


module.exports = Queue;
