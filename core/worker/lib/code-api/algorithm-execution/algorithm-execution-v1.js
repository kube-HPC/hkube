const { uuid: uuidv4 } = require('@hkube/uid');
const { consts } = require('@hkube/parsers');
const storageManager = require('@hkube/storage-manager');

class AlgorithmExecution {
    async setInputToStorage(options) {
        const { input, storage, jobId } = options;
        const storageInput = await Promise.all(input.map(i => this._mapInputToStorage(i, storage, jobId)));
        return storageInput;
    }

    async getResultFromStorage(options) {
        let { result } = options;
        const { includeResult } = options;
        if (includeResult && result && result.storageInfo) {
            const { payload } = await storageManager.getCustomData(result.storageInfo);
            result = payload;
        }
        return result;
    }

    async _mapInputToStorage(data, storage, jobId) {
        if (!this._isPrimitive(data)) {
            const uuid = uuidv4();
            const storageInfo = await storageManager.hkube.put({ jobId, taskId: uuid, data });
            storage[uuid] = { storageInfo }; // eslint-disable-line
            return `${consts.inputs.STORAGE}${uuid}`;
        }
        return data;
    }

    _isPrimitive(val) {
        return typeof val === 'boolean' || typeof val === 'number';
    }
}

module.exports = new AlgorithmExecution();
