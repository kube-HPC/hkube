const db = require('../db');

class AlgorithmStore {
    async storeAlgorithm(payload) {
        const algorithm = payload;
        if (!algorithm.created) {
            algorithm.created = Date.now();
        }
        algorithm.modified = Date.now();
        await db.algorithms.update(algorithm);
    }

    async getAlgorithm(payload) {
        const algorithm = await db.algorithms.fetch(payload);
        return algorithm;
    }
}

module.exports = new AlgorithmStore();
