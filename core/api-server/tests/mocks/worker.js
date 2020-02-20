const stateManager = require('../../lib/state/state-manager');
const storageManager = require('@hkube/storage-manager');

class WorkerStub {

    async done({ jobId, data }) {
        const results = {
            jobId,
            status: 'completed',
            data,
            level: 'info'
        }
        await stateManager.jobs.status.set(results);
        results.data = {};
        results.data.storageInfo = await storageManager.hkubeResults.put({ jobId: results.jobId, data });
        await stateManager.jobs.results.set(results);
    }
}

module.exports = new WorkerStub();
