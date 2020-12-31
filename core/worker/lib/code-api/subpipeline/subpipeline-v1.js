const storageManager = require('@hkube/storage-manager');

async function fillMissing(element) {
    if (element.info) {
        if (element.info.message && element.info.message.startsWith('data too large')) {
            const res = await storageManager.getCustomData(element.info);
            element.result = res.payload;
        }
    }
}
class SubPipelineHandler {
    async getResultFromStorage(options) {
        let { result } = options;
        const { includeResult } = options;
        if (includeResult && result && result.storageInfo) {
            const { payload } = await storageManager.getCustomData(result.storageInfo);
            payload.forEach(node => fillMissing(node));

            result = payload;
        }
        return result;
    }
}

module.exports = new SubPipelineHandler();
