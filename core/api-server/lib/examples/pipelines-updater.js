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
        log.info('--------starting sync process---------');
        await this._pipelineDriversTemplate(options);
        await this._transferJobsToDB();
        await this._transferFromStorageToDB('algorithm', defaultAlgorithms, (...args) => this._createAlgorithms(...args));
        await this._transferFromStorageToDB('pipeline', pipelines, (...args) => this._createPipelines(...args));
        await this._transferFromStorageToDB('experiment', experiments, (...args) => this._createExperiments(...args));
        await this._transferFromStorageToDB('readme/pipeline', null, (...args) => this._createPipelinesReadMe(...args));
        await this._transferFromStorageToDB('readme/algorithms', null, (...args) => this._createAlgorithmsReadMe(...args));
        log.info('--------finish sync process---------');
    }

    async _transferFromStorageToDB(type, defaultData, createFunc) {
        try {
            let list = await this._getByType(type);
            if (defaultData) {
                list = await this._getDiff(defaultData, list);
            }
            log.info(`${type}s: found ${list.length} to sync from storage to db`);
            const result = await createFunc(type, list);
            this._logSyncSuccess(type, result);
        }
        catch (error) {
            this._logSyncFailed(type, error);
        }
    }

    async _transferJobsToDB() {
        try {
            const limit = 100;
            const status = await stateManager._etcd.jobs.status.list({ limit });
            const results = await stateManager._etcd.jobs.results.list({ limit });
            const executions = await stateManager._etcd.executions.stored.list({ limit });
            let jobs = 0;

            await Promise.all(status.map(async s => {
                const { jobId, ...status } = s;
                const { jobId: j1, ...result } = results.find(r => r.jobId === s.jobId) || {};
                const { jobId: j2, ...pipeline } = executions.find(r => r.jobId === s.jobId) || {};
                try {
                    const res = await stateManager._db.jobs.create({ jobId, status, result, pipeline });
                    jobs += res.a;
                }
                catch (error) {
                    log.throttle.error(`error syncing job ${error.message}`);
                }
            }));
            if (jobs.length > 0) {
                log.info(`jobs: synced ${jobs.length} from etcd to db`);
                await this._deleteEtcdPrefix('jobs', '/jobs');
            }
            else {
                log.info('jobs: there are no data to sync');
            }
        }
        catch (error) {
            log.warning(`error syncing jobs. ${error.message}`);
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

    async _createAlgorithms(type, list) {
        const result = await stateManager.createAlgorithms(list);
        log.info(`algorithms: synced ${result?.inserted || 0} to db`);
        await this._syncAlgorithmsData(list);
        await this._deleteEtcdPrefix('algorithms', '/algorithms/store');
        await this._deleteEtcdPrefix('algorithms', '/algorithms/versions');
        await this._deleteEtcdPrefix('algorithms', '/algorithms/builds');
        await this._deleteStoragePrefix(type);
    }

    async _syncAlgorithmsData(algorithmList) {
        let versionsCount = 0;
        let buildsCount = 0;
        const limit = 1000;

        for (const algorithm of algorithmList) {
            const versions = await stateManager._etcd.algorithms.versions.list({ name: algorithm.name, limit });
            if (versions.length) {
                versionsCount += versions.length;
                await stateManager.createVersions(versions);
            }

            const builds = await stateManager._etcd.algorithms.builds.list({ name: algorithm.name, limit });
            if (builds.length) {
                buildsCount += builds.length;
                await stateManager.createBuilds(builds);
            }
        }
        log.info(`algorithms: synced ${versionsCount} versions and ${buildsCount} builds to sync from storage to db`);
    }

    _logSyncSuccess(type, result) {
        log.info(`${type}s: syncing success, synced: ${result?.inserted || 0}`);
    }

    _logSyncFailed(type, error) {
        log.warning(`${type}s: syncing failed. ${error.message}`);
    }

    async _pipelineDriversTemplate(options) {
        try {
            const driversTemplate = drivers.map(d => ({ ...d, ...options.pipelineDriversResources }));
            await Promise.all(driversTemplate.map(d => stateManager.setPipelineDriversSettings(d)));
            await this._deleteEtcdPrefix('pipelineDrivers', '/pipelineDrivers/store');
        }
        catch (error) {
            log.warning(`pipelineDrivers: failed to upload default drivers. ${error.message} `);
        }
    }

    async _createPipelines(type, list) {
        await stateManager.createPipelines(list);
        await this._deleteEtcdPrefix('pipelines', '/pipelines/store');
        await this._deleteStoragePrefix(type);
    }

    async _createExperiments(type, list) {
        await stateManager.createExperiments(list);
        await this._deleteEtcdPrefix('experiments', '/experiment');
        await this._deleteStoragePrefix(type);
    }

    async _createPipelinesReadMe(type, list) {
        await stateManager.createPipelinesReadMe(list);
        await this._deleteStoragePrefix(type);
    }

    async _createAlgorithmsReadMe(type, list) {
        await stateManager.createAlgorithmsReadMe(list);
        await this._deleteStoragePrefix(type);
    }

    async _deleteEtcdPrefix(type, path) {
        const result = await stateManager._etcd._client.delete(path, { isPrefix: true });
        log.info(`${type}: clean etcd path "${path}" deleted ${result.deleted} keys`);
    }

    async _deleteStoragePrefix(type) {
        await storageManager.hkubeStore.delete({ type });
        log.info(`${type}s: clean storage path "${type}"`);
    }
}

module.exports = new PipelinesUpdater();
