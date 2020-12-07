const stateManager = require('../../lib/state/state-manager');
const storageManager = require('@hkube/storage-manager');
const db = require('../../lib/db');

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
        results.data.storageInfo = await storageManager.hkubeResults.put({ jobId, data });
        const { data: stam, ...rest } = results;
        await db.jobs.updateStatus(rest);
        await db.jobs.updateResult(results);
        await stateManager.jobs.results.set(results);
    }
}

module.exports = new WorkerStub();
