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
        await Promise.all(algorithms.map(async (a) => {
            const count = await this._getWaitingCount(a.name);
            if (count >= 0) {
                map[a.name] = count;
            }
        }));
        return map;
    }

    async _getWaitingCount(algorithm) {
        let count = 0;
        try {
            const queue = this._producer._createQueue(algorithm);
            count = await queue.getWaitingCount();
        }
        catch {
            count = null;
        }
        return count;
    }
}

module.exports = new JobsMessageQueue();
