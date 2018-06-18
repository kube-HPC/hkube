const stateManager = require('../../lib/state/state-manager');
const storageFactory = require('../../lib/datastore/storage-factory');

class WorkerStub {

    async done({ jobId, data }) {
        const results = {
            jobId,
            status: 'completed',
            data: [data],
            level: 'info'
        }
        await stateManager.setJobStatus(results);
        results.data = {};
        results.data.storageInfo = await storageFactory.adapter.putResults({ jobId: results.jobId, data });
        await stateManager.setJobResults(results);
    }
}

module.exports = new WorkerStub();
