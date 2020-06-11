const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const experiments = require('./experiments.json');
const stateManager = require('../state/state-manager');

class PipelinesUpdater {
    async init(options) {
        await this._algorithmsTemplate(options);
        await this._pipelineDriversTemplate(options);
        await this._pipelinesTemplate(options);
        await this._experimentsTemplate(options);
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

    async _algorithmsTemplate(options) {
        try {
            let algorithmsStoreList = await this._getByType('algorithm');
            log.info(`found ${algorithmsStoreList.length} algorithms using the ${options.defaultStorage} storage`);
            if (options.addDefaultAlgorithms !== 'false') {
                algorithmsStoreList = await this._setDiff('algorithm', algorithms, algorithmsStoreList);
            }
            await Promise.all(algorithmsStoreList.map(a => stateManager.algorithms.store.set(a)));
        }
        catch (error) {
            log.warning(`failed to recover algorithms. ${error.message}`);
        }
    }

    async _pipelineDriversTemplate(options) {
        try {
            let driversTemplate = drivers;
            if (options.pipelineDriversResources) {
                driversTemplate = drivers.map(d => ({ ...d, ...options.pipelineDriversResources }));
            }
            await Promise.all(driversTemplate.map(d => stateManager.pipelineDrivers.store.set(d)));
        }
        catch (error) {
            log.warning(`failed to upload default drivers. ${error.message}`);
        }
    }

    async _experimentsTemplate(options) {
        try {
            let experimentsList = await this._getByType('experiment');
            log.info(`found ${experimentsList.length} experiments using the ${options.defaultStorage} storage`);
            experimentsList = await this._setDiff('experiment', experiments, experimentsList);
            await Promise.all(experimentsList.map(d => stateManager.experiments.set(d)));
        }
        catch (error) {
            log.warning(`failed to upload default experiments. ${error.message}`);
        }
    }

    async _pipelinesTemplate(options) {
        try {
            const pipelinesStoreList = await this._getByType('pipeline');
            log.info(`found ${pipelinesStoreList.length} pipeline using the ${options.defaultStorage} storage`);
            const pipelineList = await this._setDiff('pipeline', pipelines, pipelinesStoreList);
            await Promise.all(pipelineList.map(p => stateManager.pipelines.set(p)));
        }
        catch (error) {
            log.warning(`failed to recover pipelines. ${error.message}`);
        }
    }
}

module.exports = new PipelinesUpdater();
