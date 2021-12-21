const queuePosition = require('@hkube/consts').queuePositions;
const queueRunner = require('../queue-runner');
const validator = require('../validation');
const InvalidDataError = require('../errors/InvalidDataError');
class PreferredJobs {
    getPreferredJobsList() {
        return queueRunner.preferredQueue.queue.map(job => {
            const { score, calculated, next, ...rest } = job;
            return rest;
        });
    }

    deletePreferredJobs(jobIds) {
        const deletedJobs = jobIds.map(jobId => {
            const deletedArr = queueRunner.preferredQueue.dequeue({ jobId });
            if (deletedArr.length > 0) {
                queueRunner.queue.enqueue(deletedArr[0]);
            }
            return deletedArr.length > 0 ? deletedArr[0] : null;
        }).filter(job => !job === null);
        return deletedJobs;
    }

    query(job, tag, pipeline, jobId) {
        if (jobId) {
            return job.jobId === jobId;
        }
        if (pipeline) {
            return job.pipeline === pipeline;
        }
        if (tag) {
            return job.tags.includes(tag);
        }
        return false;
    }

    getIndex(position, tag, pipeline, jobId) {
        let index;
        if (position === queuePosition.BEFORE) {
            index = queueRunner.preferredQueue.queue.findIndex(job => this.query(job, tag, pipeline, jobId));
            if (index === -1) {
                index = 0;
            }
        }
        if (position === queuePosition.AFTER) {
            index = queueRunner.preferredQueue.queue.slice(0).reverse().findIndex(job => this.query(job, tag, pipeline, jobId));
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

    addPreferredJobs({ addedJobs }) {
        validator.preference.validatePreferenceRequest({ addedJobs });
        const { ids, position, query } = addedJobs;
        const { tag, pipeline, jobId } = query || {};
        const index = this.getIndex(position, tag, pipeline, jobId);
        const allDequeued = [];
        ids.reverse().forEach(id => {
            const dequeued = queueRunner.queue.dequeue({ jobId: id });
            if (dequeued.length > 0) {
                allDequeued.push(dequeued[0]);
                queueRunner.preferredQueue.queue.splice(index, 0, dequeued[0]);
            }
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
