const { uid } = require('@hkube/uid');
const stateManager = require('../state/state-manager');
const producer = require('../producer/preference-producer');

class PreferredJobs {
    async getPreferredJobsList() {
        return stateManager._db.jobs.search({ preference: 1 });
    }

    async deletePreferredJob(jobs) {
        const preferredJobs = await this.getPreferredJobsList();
        preferredJobs.forEach(job => {
            if (jobs.some((jobToDelete) => {
                return jobToDelete === job.jobId;
            })) {
                stateManager._db.jobs.updatePreference(job.jobId, 0);
            }
        });
        await producer.createJob({ jobId: `PREFERENCE_UPDATE${uid()}` });
    }

    async addPreferredJobs(options) {
        let preferredJobs = await this.getPreferredJobsList();
        const maxPreference = await preferredJobs.reduce((acc, job) => {
            // eslint-disable-next-line no-param-reassign
            acc = acc > job.preference ? acc : job.preference;
            return acc;
        }, 0);
        const { jobs, beforeMe } = options;
        const jobsToAdd = await Promise.all(jobs.map(job => {
            return stateManager._db.jobs.fetch({ jobId: job });
        }));
        let indexToAddAt = maxPreference + 1;
        if (beforeMe) {
            preferredJobs = preferredJobs.sort((a, b) => {
                if (a.preference < b.preference) {
                    return -1;
                }
                return 1;
            });
            let beforeJobPreference = maxPreference;
            preferredJobs.forEach(job => {
                if (job.jobId === beforeMe) {
                    beforeJobPreference = job.preference;
                    indexToAddAt = beforeJobPreference;
                }
                if (indexToAddAt <= maxPreference) { // If already found the before job.
                    stateManager._db.jobs.updatePreference(job.jobId, job.preference + jobs.length);
                }
            });
        }

        jobsToAdd.forEach(j => {
            // eslint-disable-next-line no-param-reassign
            stateManager._db.jobs.updatePreference(j.jobId, indexToAddAt);
            indexToAddAt += 1;
        });
        await producer.createJob({ jobId: `PREFERENCE_UPDATE${uid()}` });
        return [];
    }
}

module.exports = new PreferredJobs();
