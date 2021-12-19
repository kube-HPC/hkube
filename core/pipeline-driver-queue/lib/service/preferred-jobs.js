const queueRunner = require('../queue-runner');
const validator = require('../validation');
const InvalidDataError = require('../errors/InvalidDataError');
class PreferredJobs {
    async getPreferredJobsList() {
        return queueRunner.preferredQueue.queue;
    }

    async deletePreferredJobs(jobIds) {
        let deleted = 0;
        const deletedJobs = jobIds.map(jobId => {
            const deletedArr = queueRunner.preferredQueue.dequeue({ jobId });
            if (deletedArr.length > 0) {
                queueRunner.queue.enqueue(deletedArr[0]);
                deleted += deletedArr.length;
            }
            return deletedArr;
        });
        if (deleted === 0) {
            throw new InvalidDataError('JobIds do not exist in preferred queue');
        }
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

    async addPreferredJobs({ jobs, position, query }) {
        validator.preference.validatePreferenceRequest({ jobs, position, query });
        const { tag, pipeline, jobId } = query || {};
        let index;
        if (position === 'before') {
            index = queueRunner.preferredQueue.queue.findIndex(job => this.query(job, tag, pipeline, jobId));
            if (index === -1) {
                index = 0;
            }
        }
        if (position === 'after') {
            index = queueRunner.preferredQueue.queue.slice(0).reverse().findIndex(job => this.query(job, tag, pipeline, jobId));
            if (index === -1) {
                index = 0;
            }
            else {
                index = queueRunner.preferredQueue.queue.length - index;
            }
        }
        if (position === 'first') {
            index = 0;
        }
        if (position === 'last') {
            index = queueRunner.preferredQueue.queue.length;
        }
        const allDequeued = [];
        jobs.reverse().forEach(id => {
            const dequeued = queueRunner.queue.dequeue({ jobId: id });
            if (dequeued.length > 0) {
                allDequeued.push(dequeued[0]);
                queueRunner.preferredQueue.queue.splice(index, 0, dequeued[0]);
            }
        });
        if (allDequeued.length === 0) {
            throw new InvalidDataError('JobIds do not exist in general queue');
        }
        else {
            return allDequeued;
        }
    }
}

module.exports = new PreferredJobs();
