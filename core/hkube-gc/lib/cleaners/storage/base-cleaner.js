const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const { shouldDelete } = require('../../utils/time');
const PATH_PATTERN = /(?<bucket>hkube-index)\/(?<date>\d{4}-\d{2}-\d{2})\/(?<jobId>.*)/;

class BaseCleaner {
    async getJobsToDelete({ indices, maxAge }) {
        const expiredIndices = indices.filter(i => shouldDelete(i, maxAge));
        const jobsToDelete = [];
        const datesAndJobs = await Promise.all(expiredIndices.map(date => storageManager.hkubeIndex.list({ date })));
        datesAndJobs.forEach((date) => {
            date.forEach((job) => {
                const parsedPath = job.path.match(PATH_PATTERN);
                jobsToDelete.push(parsedPath.groups.jobId);
            });
        });
        return { expiredIndices, jobsToDelete };
    }

    _handleErrors(results) {
        const errors = results.filter(r => r instanceof Error);
        if (errors.length) {
            log.info(`failed to delete ${errors.length} objects`);
            errors.forEach((error) => {
                log.info(`failed to delete ${error.message}`);
            });
        }
    }
}

module.exports = BaseCleaner;
