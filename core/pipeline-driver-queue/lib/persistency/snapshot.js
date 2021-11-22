const now = require('performance-now');
const storageManager = require('@hkube/storage-manager');
const TYPE = 'pipelineDriver';

class Snapshot {
    async store({ key, data, onStart, onEnd, onError }) {
        try {
            const start = now();
            onStart({ key, length: data.length });
            await storageManager.hkubePersistency.put({ type: TYPE, name: key, data });
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
            data = await storageManager.hkubePersistency.get({ type: TYPE, name: key });
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
