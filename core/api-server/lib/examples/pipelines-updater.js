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
        await this._transferFromStorageToDB('pipeline', pipelines, (...args) => this.createPipelines(...args));
        await this._transferFromStorageToDB('experiment', experiments, (...args) => this.createExperiments(...args));
        await this._transferFromStorageToDB('readme/pipeline', null, (...args) => this.createPipelinesReadMe(...args));
        await this._transferFromStorageToDB('readme/algorithms', null, (...args) => this.createAlgorithmsReadMe(...args));
        log.info('--------finish sync process---------');
    }

    async _transferFromStorageToDB(type, defaultData, createFunc) {
        try {
            let list = await this._getByType(type);
            if (defaultData) {
                list = await this._getDiff(defaultData, list);
            }
            log.info(`found ${list.length} ${type} to sync from storage to db`);
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
            const jobs = [];

            status.forEach(s => {
                const result = results.find(r => r.jobId === s.jobId);
                const pipeline = executions.find(r => r.jobId === s.jobId);
                const job = {
                    jobId: s.jobId,
                    status: s,
                    result,
                    pipeline
                };
                jobs.push(job);
            });
            if (jobs.length > 0) {
                const result = await stateManager.createJobs(jobs);
                log.info(`synced ${result?.inserted || 0} jobs from etcd to db`);
                await this._deleteEtcdPrefix('/jobs');
            }
            else {
                log.info('there are no jobs to sync');
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
        log.info(`synced ${result?.inserted || 0} algorithms to db`);
        await this._syncAlgorithmsData(list);
        await this._deleteEtcdPrefix('/algorithm/store');
        await this._deleteEtcdPrefix('/algorithm/versions');
        await this._deleteEtcdPrefix('/algorithm/builds');
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
        log.info(`synced ${versionsCount} versions and ${buildsCount} builds to sync from storage to db`);
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
            await this._deleteEtcdPrefix('/pipelineDrivers/store');
        }
        catch (error) {
            log.warning(`failed to upload default drivers. ${error.message} `);
        }
    }

    async createPipelines(type, list) {
        await stateManager.createPipelines(list);
        await this._deleteEtcdPrefix('/pipelines/store');
        await this._deleteStoragePrefix(type);
    }

    async createExperiments(type, list) {
        await stateManager.createExperiments(list);
        await this._deleteEtcdPrefix('/experiment');
        await this._deleteStoragePrefix(type);
    }

    async createPipelinesReadMe(type, list) {
        await stateManager.createPipelinesReadMe(list);
        await this._deleteStoragePrefix(type);
    }

    async createAlgorithmsReadMe(type, list) {
        await stateManager.createAlgorithmsReadMe(list);
        await this._deleteStoragePrefix(type);
    }

    async _deleteEtcdPrefix(path) {
        const result = await stateManager._etcd._client.delete(path, { isPrefix: true });
        log.info(`clean etcd path "${path}" deleted ${result.deleted} keys`);
    }

    async _deleteStoragePrefix(type) {
        await storageManager.hkubeStore.delete({ type });
        log.info(`clean storage path "${type}"`);
    }
}

module.exports = new PipelinesUpdater();
