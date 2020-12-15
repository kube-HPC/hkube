const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const experiments = require('./experiments.json');
const stateManager = require('../state/state-manager');

class PipelinesUpdater {
    async init(options) {
        this._defaultStorage = options.defaultStorage;
        const addDefaultAlgorithms = options.addDefaultAlgorithms !== 'false';
        const defaultAlgorithms = addDefaultAlgorithms ? algorithms : null;

        await this._pipelineDriversTemplate(options);
        await this._transferFromStorageToDB('algorithm', defaultAlgorithms, (list) => this._createAlgorithms(list));
        await this._transferFromStorageToDB('pipeline', pipelines, (list) => stateManager.createPipelines(list));
        await this._transferFromStorageToDB('experiment', experiments, (list) => stateManager.createExperiments(list));
        await this._transferFromStorageToDB('readme/pipeline', null, (list) => stateManager.createPipelinesReadMe(list));
        await this._transferFromStorageToDB('readme/algorithms', null, (list) => stateManager.createAlgorithmsReadMe(list));
    }

    async _transferFromStorageToDB(type, defaultData, createFunc) {
        try {
            let list = await this._getByType(type);
            if (defaultData) {
                list = await this._getDiff(defaultData, list);
            }
            const result = await createFunc(list);
            this._logSyncSuccess(type, result);
        }
        catch (error) {
            this._logSyncFailed(type, error);
        }
    }

    async _getDiff(defaultList, storeList) {
        const diff = defaultList.filter(a => !storeList.some(v => v.name === a.name));
        return [...diff, ...storeList];
    }

    async _getByType(type) {
        const keys = await storageManager.hkubeStore.list({ type });
        return Promise.all(keys.map(a => storageManager.get({ path: a.path })));
    }

    async _createAlgorithms(list) {
        await stateManager.createAlgorithms(list);
        await stateManager.syncAlgorithmsVersions(list);
    }

    _logSyncSuccess(type, result) {
        log.info(`syncing ${type}s success, synced: ${result?.inserted || 0}`);
    }

    _logSyncFailed(type, error) {
        log.warning(`syncing ${type}s failed. ${error.message}`);
    }

    async _pipelineDriversTemplate(options) {
        try {
            const driversTemplate = drivers.map(d => ({ ...d, ...options.pipelineDriversResources }));
            await Promise.all(driversTemplate.map(d => stateManager.setPipelineDriversSettings(d)));
        }
        catch (error) {
            log.warning(`failed to upload default drivers. ${error.message} `);
        }
    }
}

module.exports = new PipelinesUpdater();
