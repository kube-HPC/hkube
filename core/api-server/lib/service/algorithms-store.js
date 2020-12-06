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
        return db.algorithms.fetch(payload);
    }

    async getAlgorithms(payload) {
        return db.algorithms.fetchAll(payload);
    }

    async getAlgorithmsByNames(payload) {
        return db.algorithms.fetchMany(payload);
    }

    async getAlgorithmsMapByNames(payload) {
        const algorithms = await this.getAlgorithmsByNames(payload);
        const algorithmsMap = new Map(algorithms.map((a) => [a.name, a]));
        return algorithmsMap;
    }

    async getAlgorithmsByName(payload) {
        return db.algorithms.fetchAllByName(payload);
    }
}

module.exports = new AlgorithmStore();
