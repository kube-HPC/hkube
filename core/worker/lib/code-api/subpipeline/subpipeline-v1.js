const storageManager = require('@hkube/storage-manager');

class SubPipelineHandler {
    async getResultFromStorage(options) {
        let { result } = options;
        const { includeResult } = options;
        if (includeResult && result && result.storageInfo) {
            const { payload } = await storageManager.getCustomData(result.storageInfo);
            result = payload;
        }
        return result;
    }
}

module.exports = new SubPipelineHandler();
