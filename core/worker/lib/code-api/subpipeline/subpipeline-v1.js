const storageManager = require('@hkube/storage-manager');

class SubPipelineHandler {
    async getResultFromStorage(options) {
        let { result } = options;
        const { includeResult } = options;
        if (includeResult && result && result.storageInfo) {
            result = await storageManager.get(result.storageInfo);
        }
        return result;
    }
}

module.exports = new SubPipelineHandler();
