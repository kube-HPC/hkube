const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');

class AlgorithmStore {
    async storeAlgorithm(options) {
        const algorithm = options;
        if (!algorithm.created) {
            algorithm.created = Date.now();
        }
        algorithm.modified = Date.now();
        await storageManager.hkubeStore.put({ type: 'algorithm', name: algorithm.name, data: algorithm });
        await stateManager.algorithms.store.set(algorithm);
    }
}

module.exports = new AlgorithmStore();
