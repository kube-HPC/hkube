const now = require('performance-now');
const dataStore = require('./data-store');

class Scoring {
    async store({ key, data, onStart, onEnd, onError }) {
        try {
            const start = now();
            onStart({ key, length: data.length });
            const scoreArray = data.map(d => d.score);
            await dataStore.storeQueue({ name: key, data: scoreArray, timestamp: Date.now() });
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
