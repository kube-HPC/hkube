const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const stateManager = require('../state/state-manager');

class PipelinesUpdater {
    async init(options) {
        try {
            let algorithmsStoreList = await this._getByType('algorithm');
            if (options.addDefaultAlgorithms !== 'false') {
                algorithmsStoreList = await this._setDiff('algorithm', algorithms, algorithmsStoreList);
            }
            await Promise.all(algorithmsStoreList.map(a => stateManager.setAlgorithm(a)));
        }
        catch (error) {
            log.warning(`failed to upload default algorithms. ${error.message}`);
        }

        try {
            await Promise.all(drivers.map(d => stateManager.setPipelineDriverTemplate(d)));
        }
        catch (error) {
            log.warning(`failed to upload default drivers. ${error.message}`);
        }

        try {
            const pipelinesStoreList = await this._getByType('pipeline');
            const pipelineList = await this._setDiff('pipeline', pipelines, pipelinesStoreList);
            await Promise.all(pipelineList.map(p => stateManager.setPipeline(p)));
        }
        catch (error) {
            log.warning(`failed to upload default pipelines. ${error.message}`);
        }
    }

    async _setDiff(type, defaultList, storeList) {
        const diff = defaultList.filter(a => !storeList.some(v => v.name === a.name));
        await Promise.all(diff.map(a => storageManager.hkubeStore.put({ type, name: a.name, data: a })));
        return [...diff, ...storeList];
    }

    async _getByType(type) {
        const keys = await storageManager.hkubeStore.list({ type });
        return Promise.all(keys.map(a => storageManager.get({ path: a.path })));
    }
}

module.exports = new PipelinesUpdater();
