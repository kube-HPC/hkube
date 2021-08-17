const now = require('performance-now');
const etcd = require('./etcd');

class Scoring {
    async store({ key, data, pendingAmount, onStart, onEnd, onError }) {
        try {
            const start = now();
            onStart({ key, length: data.length });
            // do we want to limit our scoring array?
            const scoreArray = data.slice(0, 5000).map(d => d.score);
            await etcd.updateQueueData({ name: key, data: scoreArray, pendingAmount, timestamp: Date.now() });
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
