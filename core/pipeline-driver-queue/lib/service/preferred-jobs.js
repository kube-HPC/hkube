const queueRunner = require('../queue-runner');
class PreferredJobs {
    async getPreferredJobsList() {
        return null;
    }

    async deletePreferredJob() {
        return null;
    }

    async addPreferredJobs({ jobs, query }) {
        jobs.forEach(jobId => {
            const dequeued = queueRunner.queue.dequeue({ jobId });
            dequeued.forEach(
                job => {
                    queueRunner.preferredQueue.queue.push(job);
                }
            );
        });
    }
}

module.exports = new PreferredJobs();
