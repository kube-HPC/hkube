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
        results.data = {};
        results.data.storageInfo = await storageManager.hkubeResults.put({ jobId, data });
        await stateManager.updateJobStatus(results);
        await stateManager.updateJobResult(results);
    }
}

module.exports = new WorkerStub();
