const stateManager = require('../../lib/state/state-manager');
const storageManager = require('@hkube/storage-manager');
const db = require('../../lib/db');

class WorkerStub {

    async done({ jobId, data }) {
        const results = {
            status: 'completed',
            data,
            level: 'info'
        }
        await stateManager.jobs.status.set({ jobId, ...results });
        results.data = {};
        results.data.storageInfo = await storageManager.hkubeResults.put({ jobId, data });
        await db.jobs.updateStatus({ jobId, data: results })
        await db.jobs.updateResult({ jobId, data: results })
        await stateManager.jobs.results.set({ jobId, ...results });
    }
}

module.exports = new WorkerStub();
