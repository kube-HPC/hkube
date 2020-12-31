const storageManager = require('@hkube/storage-manager');

async function fillMissing(element) {
    if (element.info) {
        if (element.info.message?.startsWith('data too large')) {
            const res = await storageManager.getCustomData(element.info);
            // eslint-disable-next-line no-param-reassign
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
            for (let i = 0; i < payload.length; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await fillMissing(payload[i]);
            }
            result = payload;
        }
        return result;
    }
}

module.exports = new SubPipelineHandler();
