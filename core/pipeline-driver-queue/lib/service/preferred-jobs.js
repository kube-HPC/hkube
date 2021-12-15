const queueRunner = require('../queue-runner');
const validator = require('../validation');
class PreferredJobs {
    async getPreferredJobsList() {
        return null;
    }

    async deletePreferredJob() {
        return null;
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
        const { tag, pipeline, jobId } = query;
        let index;
        if (position === 'before') {
            index = queueRunner.preferredQueue.queue.findIndex(job => this.query(job, tag, pipeline, jobId));
            if (index === -1) {
                index = 0;
            }
        }
        if (position === 'after') {
            index = queueRunner.preferredQueue.queue.reverse().findIndex(job => this.query(job, tag, pipeline, jobId));
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
        jobs.reverse().forEach(id => {
            const dequeued = queueRunner.queue.dequeue({ jobId: id });
            if (dequeued.length > 0) {
                queueRunner.preferredQueue.queue.splice(index, 0, dequeued[0]);
            }
        });
    }
}

module.exports = new PreferredJobs();
