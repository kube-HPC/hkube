const queuePosition = require('@hkube/consts').queuePositions;
const queueRunner = require('../queue-runner');
const validator = require('../validation');
const InvalidDataError = require('../errors/InvalidDataError');
const PagingBase = require('./pagingBase');

class PreferredJobs extends PagingBase {
    getPreferredJobsList() {
        return queueRunner.preferredQueue.queue.map(job => {
            const { score, calculated, next, ...rest } = job;
            return rest;
        });
    }

    _filteredFlatJobList(filter) {
        let filteredList;
        if (filter) {
            filteredList = queueRunner.preferredQueue.queue.filter(job => {
                if (filter.pipelineName) {
                    return job.pipelineName === filter.pipelineName;
                }
                if (filter.tag) {
                    return job.tags?.findIndex((tag) => tag === filter.tag) > -1;
                }
                return true;
            });
        }
        else filteredList = queueRunner.preferredQueue.queue;
        return filteredList.map(job => {
            const { score, calculated, next, ...rest } = job;
            return rest;
        });
    }

    getPreferredAggregatedByPipeline() {
        const returnList = this.getPreferredJobsList().reduce((rv, job) => {
            // eslint-disable-next-line no-param-reassign
            if (rv.length > 0) {
                if (rv[rv.length - 1].name === job.pipelineName) {
                    // eslint-disable-next-line no-param-reassign
                    rv[rv.length - 1].count += 1;
                    return rv;
                }
            }
            rv.push({ name: job.pipelineName, count: 1, fromJob: job.jobId });
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
                    return rv;
                }
            }
            rv.push({ name: job.tags.toString(), count: 1, fromJob: job.jobId });
            return rv;
        }, []);
        return returnList;
    }

    deletePreferredJobs(jobIds) {
        const deletedJobs = jobIds.map(jobId => {
            const deletedArr = queueRunner.preferredQueue.dequeue({ jobId });
            if (deletedArr.length > 0) {
                const job = deletedArr[0];
                queueRunner.queue.enqueue(job);
            }
            return deletedArr.length > 0 ? deletedArr[0] : null;
        }).filter(job => job !== null);
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
