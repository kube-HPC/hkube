const now = require('performance-now');
const storageManager = require('@hkube/storage-manager');

class Snapshot {
    async store({ data, key, onStart, onEnd, onError }) {
        try {
            const start = now();
            onStart({ key, length: data.length });
            // after POC, need to add persistency module inside storageManager.
            await storageManager.hkubeExecutions.put({ jobId: key, data });
            const end = now();
            const timeTook = (end - start).toFixed(3);
            onEnd({ key, length: data.length, timeTook });
        }
        catch (e) {
            onError({ key, length: data.length, error: e.message });
        }
    }

    async get({ key, onStart, onEnd, onError }) {
        let data;
        try {
            const start = now();
            onStart({ key });
            data = await storageManager.hkubeExecutions.get({ jobId: key });
            const end = now();
            const timeTook = (end - start).toFixed(3);
            onEnd({ key, timeTook });
        }
        catch (e) {
            onError({ key, error: e.message });
        }
        return data;
    }
}

module.exports = new Snapshot();
