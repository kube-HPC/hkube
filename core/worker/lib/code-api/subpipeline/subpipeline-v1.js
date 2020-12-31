const storageManager = require('@hkube/storage-manager');

class SubPipelineHandler {
    async getResultFromStorage(options) {
        let { result } = options;
        const { includeResult } = options;
        if (includeResult && result && result.storageInfo) {
            const { payload } = await storageManager.getCustomData(result.storageInfo);
            await Promise.all(payload.map(p => this._fillMissing(p)));
            result = payload;
        }
        return result;
    }

    async _fillMissing(element) {
        if (element?.info?.isBigData) {
            const res = await storageManager.getCustomData(element.info);
            element.result = res.payload;
        }
    }
}

module.exports = new SubPipelineHandler();
