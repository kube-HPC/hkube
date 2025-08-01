const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const { Factory } = require('@hkube/redis-utils');
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const experiments = require('./experiments.json');
const stateManager = require('../state/state-manager');
const algorithmsVersionsService = require('../../lib/service/algorithm-versions');
const pipelinesVersionsService = require('../../lib/service/pipeline-versions');
const keycloak = require('../../lib/service/keycloak');

class PipelinesUpdater {
    async init(options) {
        this._defaultStorage = options.defaultStorage;
        const addDefaultAlgorithms = options.addDefaultAlgorithms !== 'false';
        const defaultAlgorithms = addDefaultAlgorithms ? algorithms : null;
        log.info('--------starting sync process---------');
        await this._pipelineDriversTemplate(options);
        await this._transferJobsToDB();
        await this._transferGraphsToDB(options);
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

    async _transferGraphsToDB(options) {
        try {
            const limit = 1000;
            const fields = {
                graph: true,
                jobId: true
            }
            const jobs = await stateManager.searchJobs({
                sort: { 'pipeline.startTime': 'desc' },
                fields,
                limit
            });
            const missingGraphs = jobs.filter(j => !j.graph);
            if (missingGraphs.length === 0) {
                log.info('jobs: there are no graphs to sync');
                return;
            }
            const redisClient = Factory.getClient(options.redis);
            const PREFIX_PATH = 'hkube:pipeline:graph';
            let migrated = 0;
            await Promise.all(missingGraphs.map(async j => {
                const { jobId } = j;
                try {
                    const key = `/${PREFIX_PATH}/${jobId}`;
                    const graphJson = await redisClient.get(key);
                    if (!graphJson) {
                        return;
                    }
                    const graph = JSON.parse(graphJson);
                    await stateManager._db.jobs.updateGraph({ jobId, graph })
                    await redisClient.del(key);
                    migrated += 1;
                } catch (error) {
                    log.throttle.warning(`error syncing graph ${error.message}`);
                }
            }))
            if (migrated > 0) {
                log.info(`jobs: synced ${migrated} graphs from redis to db`);
            }
            else {
                log.info('jobs: there are no graphs to sync');
            }
        } catch (error) {
            log.warning(`error syncing graphs. ${error.message}`);
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
                    log.throttle.warning(`error syncing job ${error.message}`);
                }
            }));
            if (jobs.length > 0) {
                log.info(`jobs: synced ${jobs.length} from etcd to db`);
                await this._deleteEtcdPrefix('jobs', '/jobs');
            }
            else {
                log.info('jobs: there are no jobs to sync');
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
        try {
            const result = await stateManager.createAlgorithms(list);
            log.info(`algorithms: synced ${result?.inserted || 0} to db`);
            await this._deleteEtcdPrefix('algorithms', '/algorithms/store');
            await this._deleteEtcdPrefix('algorithms', '/algorithms/versions');
            await this._deleteEtcdPrefix('algorithms', '/algorithms/builds');
            await this._deleteStoragePrefix(type);
        }
        finally {
            // In case algorithms already exist in db, check if a new version needs to be added
            await this._syncAlgorithmsData(list);
        }
    }

    async _syncAlgorithmsData(algorithmList) {
        let versionsCount = 0;
        let buildsCount = 0;
        let addedVersionsCount = 0;
        const limit = 1000;

        for (const algorithm of algorithmList) {
            const versions = await stateManager._etcd.algorithms.versions.list({ name: algorithm.name, limit });

            if (versions.length) {
                versionsCount += versions.length;
                await stateManager.createVersions(versions);
            }
            else {
                // Add versions only to algorithms with no versions.
                const existingVersion = await algorithmsVersionsService.getLatestSemver(algorithm);
                if (!existingVersion) {
                    const userName = keycloak.getPreferredUsername();
                    const newVersion = await algorithmsVersionsService.createVersion(algorithm, undefined, userName);
                    await algorithmsVersionsService.applyVersion({ name: algorithm.name, version: newVersion, force: true });
                    addedVersionsCount++;
                }
            }

            const builds = await stateManager._etcd.algorithms.builds.list({ name: algorithm.name, limit });
            if (builds.length) {
                buildsCount += builds.length;
                await stateManager.createBuilds(builds);
            }
        }
        log.info(`algorithms: synced ${versionsCount} versions, added ${addedVersionsCount}, made ${buildsCount} builds to sync from storage to db`);
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
        try {
            await stateManager.createPipelines(list);
            await this._deleteEtcdPrefix('pipelines', '/pipelines/store');
            await this._deleteStoragePrefix(type);
        }
        finally {
            // In case pipelines exist in db, createPipelines will fail but syncing is needed any case.
            await this._syncPipelinesData(list);
        }
    }

    async _syncPipelinesData(pipelineList) {
        let versionsCount = 0;
        let addedVersionsCount = 0;
        const limit = 1000;

        for (const pipeline of pipelineList) {
            const name = pipeline.name;
            const versions = await stateManager.getVersions({ name, limit }, true);

            if (versions.length) {
                versionsCount += versions.length;
            }
            else {
                // Add versions only to pipelines with no versions.
                const existingVersion = await pipelinesVersionsService.getLatestSemver(pipeline);
                if (!existingVersion) {
                    const userName = keycloak.getPreferredUsername();
                    const newVersion = await pipelinesVersionsService.createVersion(pipeline, userName);
                    addedVersionsCount++;
                    await pipelinesVersionsService.applyVersion({ name, version: newVersion, force: true });
                }
            }
        }
        log.info(`pipelines: synced ${versionsCount} versions and added ${addedVersionsCount} versions to sync from storage to db`);
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
