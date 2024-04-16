const now = require('performance-now');
const dataStore = require('./data-store');

class Scoring {
    async store({ key, data, maxSize, onStart, onEnd, onError }) {
        try {
            const start = now();
            onStart({ key, length: data.length });
            const dataArray = data.slice(0, maxSize).map(d => ({ score: d.score, maxExceeded: d.maxExceeded }));
            await dataStore.storeQueue({ name: key, data: dataArray.score, maxExceeded: dataArray.maxExceeded, timestamp: Date.now() });
            const end = now();
            const timeTook = (end - start).toFixed(3);
            onEnd({ key, length: data.length, timeTook });
        }
        catch (e) {
            onError({ key, length: data.length, error: e.message });
        }
    }
}

module.exports = new Scoring();
