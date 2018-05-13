const stateManager = require('../../lib/state/state-manager');
const storageFactory = require('../../lib/datastore/storage-factory');

class WorkerStub {

    async done({ jobId, taskId, data }) {
        const storageInfo = await storageFactory.adapter.put({ jobId, taskId, data });
        const object = { green: data };
        const storageLink = {
            metadata: null,
            storageInfo
        };
        const results = {
            jobId,
            status: 'completed',
            data: [{ result: storageLink }]
        }
        await stateManager.setJobStatus(results);
        results.data = await storageFactory.adapter.putResults({ jobId: results.jobId, data: results.data })
        await stateManager.setJobResults(results);
    }
}

module.exports = new WorkerStub();
