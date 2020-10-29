const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');

class AlgorithmStore {
    async storeAlgorithm(options) {
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        await stateManager.algorithms.store.set(options);
    }
}

module.exports = new AlgorithmStore();
