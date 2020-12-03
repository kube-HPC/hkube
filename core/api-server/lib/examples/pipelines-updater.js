const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const experiments = require('./experiments.json');
const stateManager = require('../state/state-manager');
const db = require('../db');

class PipelinesUpdater {
    async init(options) {
        this._defaultStorage = options.defaultStorage;
        this._addDefaultAlgorithms = options.addDefaultAlgorithms !== 'false';
        await this._algorithmsTemplate('algorithm');
        await this._pipelineDriversTemplate(options);
        await this._pipelinesTemplate('pipeline');
        await this._experimentsTemplate('experiment');
    }

    async _getDiff(defaultList, storeList) {
        const diff = defaultList.filter(a => !storeList.some(v => v.name === a.name));
        return [...diff, ...storeList];
    }

    async _getByType(type) {
        const keys = await storageManager.hkubeStore.list({ type });
        return Promise.all(keys.map(a => storageManager.get({ path: a.path })));
    }

    async _algorithmsTemplate(type) {
        try {
            let algorithmList = await this._getByType(type);
            if (this._addDefaultAlgorithm) {
                algorithmList = await this._getDiff(algorithms, algorithmList);
            }
            this._logSync(type, algorithmList.length);
            const result = await db.algorithms.createMany(algorithmList);
            await Promise.all(algorithmList.map(a => this.syncVersions(a)));
            await this._logSyncSuccess(type, result);
        }
        catch (error) {
            this._logSyncFailed(type, error);

        }
    }

    async syncVersions(algorithm) {
        const versions = await stateManager.algorithms.versions.list(algorithm);
        await db.algorithms.versions.createMany(versions);
    }

    _logSync(type, list) {
        log.info(`syncing ${list} ${type}s from ${this._defaultStorage} storage to hkube db`);
    }

    _logSyncSuccess(type, result) {
        log.info(`syncing ${type}s success, synced: ${result.inserted}`);
    }

    _logSyncFailed(type, error) {
        log.warning(`syncing ${type}s failed. ${error.message}`);
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
            log.warning(`failed to upload default drivers.${error.message} `);
        }
    }

    async _experimentsTemplate(type) {
        try {
            let experimentList = await this._getByType(type);
            experimentList = await this._getDiff(experiments, experimentList);
            this._logSync(type, experimentList.length);
            const result = await db.experiments.createMany(experimentList);
            this._logSyncSuccess(type, result);
        }
        catch (error) {
            this._logSyncFailed(type, error);
        }
    }

    async _pipelinesTemplate(type) {
        try {
            let pipelineList = await this._getByType(type);
            pipelineList = await this._getDiff(pipelines, pipelineList);
            this._logSync(type, pipelineList.length);
            const result = await db.pipelines.createMany(pipelineList);
            this._logSyncSuccess(type, result);
        }
        catch (error) {
            this._logSyncFailed(type, error);
        }
    }
}

module.exports = new PipelinesUpdater();
