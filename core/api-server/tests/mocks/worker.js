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
        await stateManager.setJobStatus(results);
        results.data = {};
        results.data.storageInfo = await storageManager.hkubeResults.put({ jobId: results.jobId, data });
        await stateManager.setJobResults(results);
    }
}

module.exports = new WorkerStub();
