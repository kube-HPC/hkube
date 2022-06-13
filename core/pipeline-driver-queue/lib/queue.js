/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
const Events = require('events');
const orderby = require('lodash.orderby');
const remove = require('lodash.remove');
const { pipelineStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { queueEvents, componentName } = require('./consts');
const dataStore = require('./persistency/data-store');

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

    async persistencyLoad(staticOrder = false) {
        if (!this._persistency) {
            return;
        }
        const data = await this._persistency.get(this._name);
        const orderedData = [];
        let previous = 'FirstInLine';
        data?.forEach(() => {
            const item = data.find(job => job.next === previous);
            previous = item.jobId;
            orderedData.push(item);
        });
        const filteredData = [];
        for (let i = 0; i < orderedData.length; i++) {
            const item = orderedData[i];
            const { jobId } = item;
            log.info(`getting recovery info for job ${jobId} loaded from persistency`, { component, jobId });
            const jobData = await dataStore.getJob({ jobId });
            const { status, pipeline } = jobData || {};
            let skip = false;
            if (!pipeline) {
                log.warning(`unable to find pipeline for job ${jobId} loaded from persistency`, { component, jobId });
                skip = true;
            }
            if (status && (status.status === pipelineStatuses.STOPPED || status.status === pipelineStatuses.PAUSED)) {
                log.warning(`job ${jobId} loaded from persistency with state stop therefore will not added to queue`, { component, jobId });
                skip = true;
            }
            if (!skip) {
                item.next = i === 0 ? 'FirstInLine' : orderedData[i - 1].jobId;
                filteredData.push(item);
            }
        }
        if (filteredData.length > 0) {
            filteredData.forEach(q => {
                const item = {
                    ...q,
                    calculated: {
                        latestScores: {}
                    }
                };
                if (staticOrder) {
                    this.queue.push(item);
                }
                else {
                    this.enqueue(item, true);
                }
            });
            log.info(`calculating heuristics for queue ${this._name} loaded from persistency`, { component });
            this.calculateHeuristic();
        }
    }

    async persistenceStore() {
        const data = this.getQueue();
        if (!this._persistency || !data) {
            return;
        }
        let previous = 'FirstInLine';
        const mapData = data.map(q => {
            const { calculated, done, ...rest } = q;
            const result = { ...rest, next: previous };
            previous = result.jobId;
            return result;
        });
        await this._persistency.store(mapData, this._name);
    }

    updateHeuristic(scoreHeuristic) {
        this.scoreHeuristic = scoreHeuristic.run.bind(scoreHeuristic);
    }

    calculateHeuristic() {
        this.queue = this.queue.map(q => this.scoreHeuristic(q));
        this.queue = orderby(this.queue, 'score', 'desc');
    }

    enqueue(job, skipHeuristic = false) {
        this.queue.push(job);
        if (!skipHeuristic) {
            this.calculateHeuristic();
        }
        this.emit(queueEvents.INSERT, job);
        log.info(`new job inserted to queue ${this._name}, queue size: ${this.size}`, { component });
    }

    dequeue(job) {
        const removedJob = remove(this.queue, j => j.jobId === job.jobId);
        if (removedJob.length > 0) {
            this.emit(queueEvents.POP, job);
            log.info(`job pop from queue ${this._name}, queue size: ${this.size}`, { component });
        }
        return removedJob;
    }

    remove(jobId) {
        const jobs = remove(this.queue, job => job.jobId === jobId);
        if (jobs.length > 0) {
            this.emit(queueEvents.REMOVE, jobs[0]);
            log.info(`job removed from queue ${this._name}, queue size: ${this.size}`, { component });
        }
        return jobs;
    }

    get size() {
        return this.queue.length;
    }

    get name() {
        return this._name;
    }

    getQueue(filter = () => true) {
        return this.queue.filter(filter);
    }
}

module.exports = Queue;
