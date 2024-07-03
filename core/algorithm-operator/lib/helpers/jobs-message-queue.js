const { Producer } = require('@hkube/producer-consumer');

class JobsMessageQueue {
    async init(options) {
        this._producer = new Producer({
            setting: {
                redis: options.redis,
                ...options.JobsMessageQueue
            }
        });
    }

    async getWaitingCount(algorithms) {
        const map = {};
        this._updateMaxRedisListeners(algorithms.length);
        await Promise.all(algorithms.map(async (a) => {
            const count = await this._getWaitingCount(a.name);
            if (count >= 0) {
                map[a.name] = count;
            }
        }));
        return map;
    }

    async _getWaitingCount(algorithmName) {
        let count = 0;
        try {
            const queue = this._producer._createQueue(algorithmName);
            count = await queue.getWaitingCount();
        }
        catch {
            count = null;
        }
        return count;
    }

    async _updateMaxRedisListeners(amountOfListeners) {
        this._producer.updateMaxRedisListeners(amountOfListeners);
    }
}

module.exports = new JobsMessageQueue();
