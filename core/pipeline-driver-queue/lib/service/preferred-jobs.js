const queuePosition = require('@hkube/consts').queuePositions;
const log = require('@hkube/logger').GetLogFromContainer();
const queueRunner = require('../queue-runner');
const validator = require('../validation');
const InvalidDataError = require('../errors/InvalidDataError');
const PagingBase = require('./pagingBase');
const { componentName } = require('../consts');
const component = componentName.PREFERRED_SERVICE;

class PreferredJobs extends PagingBase {
    getPreferredJobsList() {
        return queueRunner.preferredQueue.queue.map(job => {
            const { score, calculated, next, ...rest } = job;
            return rest;
        });
    }

    _getCount() {
        return queueRunner.preferredQueue.queue.length;
    }

    _filteredFlatJobList(filter) {
        return super._filter(filter, queueRunner.preferredQueue);
    }

    getPreferredAggregatedByPipeline() {
        const returnList = this.getPreferredJobsList().reduce((rv, job) => {
            // eslint-disable-next-line no-param-reassign
            if (rv.length > 0) {
                if (rv[rv.length - 1].name === job.pipelineName) {
                    // eslint-disable-next-line no-param-reassign
                    rv[rv.length - 1].count += 1;
                    // eslint-disable-next-line no-param-reassign
                    rv[rv.length - 1].lastJob = job.jobId;
                    return rv;
                }
            }
            rv.push({ name: job.pipelineName, count: 1, lastJob: job.jobId });
            return rv;
        }, []);
        return returnList;
    }

    getPreferredAggregatedByTags() {
        const returnList = this.getPreferredJobsList().reduce((rv, job) => {
            // eslint-disable-next-line no-param-reassign
            if (rv.length > 0) {
                if (rv[rv.length - 1].name === job.tags.toString()) {
                    // eslint-disable-next-line no-param-reassign
                    rv[rv.length - 1].count += 1;
                    // eslint-disable-next-line no-param-reassign
                    rv[rv.length - 1].lastJob = job.jobId;
                    return rv;
                }
            }
            rv.push({ name: job.tags.toString(), count: 1, lastJob: job.jobId });
            return rv;
        }, []);
        return returnList;
    }

    deletePreferredJobs(jobIds) {
        const deletedJobs = jobIds.map(jobId => {
            const deletedArr = queueRunner.preferredQueue.dequeue({ jobId });
            if (deletedArr.length > 0) {
                const job = deletedArr[0];
                queueRunner.queue.enqueue(job, true);
            }
            return deletedArr.length > 0 ? deletedArr[0] : null;
        }).filter(job => job !== null);
        log.info(`calculating heuristics for ${queueRunner.queue.name} queue loaded from persistency`, { component });
        queueRunner.queue.calculateHeuristic();
        return deletedJobs;
    }

    query(job, tag, pipelineName, jobId) {
        if (jobId) {
            return job.jobId === jobId;
        }
        if (pipelineName) {
            return job.pipelineName === pipelineName;
        }
        if (tag) {
            return job.tags?.includes(tag);
        }
        return false;
    }

    getIndex(position, tag, pipelineName, jobId) {
        let index;
        if (position === queuePosition.BEFORE) {
            index = queueRunner.preferredQueue.queue.findIndex(job => this.query(job, tag, pipelineName, jobId));
            if (index === -1) {
                index = 0;
            }
        }
        if (position === queuePosition.AFTER) {
            index = queueRunner.preferredQueue.queue.slice(0).reverse().findIndex(job => this.query(job, tag, pipelineName, jobId));
            if (index === -1) {
                index = 0;
            }
            else {
                index = queueRunner.preferredQueue.queue.length - index;
            }
        }
        if (position === queuePosition.FIRST) {
            index = 0;
        }
        if (position === queuePosition.LAST) {
            index = queueRunner.preferredQueue.queue.length;
        }
        return index;
    }

    addPreferredJobs(addedJobs) {
        validator.preference.validatePreferenceRequest(addedJobs);
        const { jobs, position, query } = addedJobs;
        const { tag, pipelineName, jobId } = query || {};
        const index = this.getIndex(position, tag, pipelineName, jobId);
        const allDequeued = [];
        jobs.reverse().map(async id => {
            const dequeued = queueRunner.queue.dequeue({ jobId: id });
            if (dequeued.length > 0) {
                allDequeued.push(dequeued[0]);
                queueRunner.preferredQueue.queue.splice(index, 0, { ...dequeued[0], score: 1 });
            }
            return id;
        });
        if (allDequeued.length === 0) {
            throw new InvalidDataError('None of the jobs exist in the general queue');
        }
        else {
            return allDequeued;
        }
    }
}

module.exports = new PreferredJobs();
