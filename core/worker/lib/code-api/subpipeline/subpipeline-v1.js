
const storageManager = require('@hkube/storage-manager');

class SubPipelineHandler {
    async getResultFromStorage(options) {
        return storageManager.get(options.storageInfo);
    }
}

module.exports = new SubPipelineHandler();
