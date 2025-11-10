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
const component = require('../consts/componentNames').PIPELINES_UPDATER;

class PipelinesUpdater {
    async init(options) {
        this._defaultStorage = options.defaultStorage;
        const addDefaultAlgorithms = options.addDefaultAlgorithms !== 'false';
        const defaultAlgorithms = addDefaultAlgorithms ? algorithms : null;
        log.info('--------starting sync process---------', { component });
        await this._pipelineDriversTemplate(options);
        await this._transferJobsToDB();
        await this._transferGraphsToDB(options);
        await this._transferFromStorageToDB('algorithm', defaultAlgorithms, (...args) => this._createAlgorithms(...args));
        await this._transferFromStorageToDB('pipeline', pipelines, (...args) => this._createPipelines(...args));
        await this._transferFromStorageToDB('experiment', experiments, (...args) => this._createExperiments(...args));
        await this._transferFromStorageToDB('readme/pipeline', null, (...args) => this._createPipelinesReadMe(...args));
        await this._transferFromStorageToDB('readme/algorithms', null, (...args) => this._createAlgorithmsReadMe(...args));
        log.info('--------finish sync process---------', { component });
    }

    async _transferFromStorageToDB(type, defaultData, createFunc) {
        try {
            let list = await this._getByType(type);
            if (defaultData) {
                list = await this._getDiff(defaultData, list);
            }
            if (list.length === 0) {
                log.info(`${type}s: no items to sync from storage to db`, { component });
                return;
            }
            log.info(`${type}s: found ${list.length} to sync from storage to db`, { component });
            const resultMessage = await createFunc(type, list);
            this._logSyncSuccess(type, resultMessage);
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
                log.info('jobs: there are no graphs to sync', { component });
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
                    log.throttle.warning(`error syncing graph ${error.message}`, { component });
                }
            }))
            if (migrated > 0) {
                log.info(`jobs: synced ${migrated} graphs from redis to db`, { component });
            }
            else {
                log.info('jobs: there are no graphs to sync', { component });
            }
        } catch (error) {
            log.warning(`error syncing graphs. ${error.message}`, { component });
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
                    jobs ++;
                }
                catch (error) {
                    log.throttle.warning(`error syncing job ${error.message}`, { component });
                }
            }));
            if (jobs > 0) {
                log.info(`jobs: synced ${jobs} from etcd to db`, { component });
                await this._deleteEtcdPrefix('jobs', '/jobs');
            }
            else {
                log.info('jobs: there are no jobs to sync', { component });
            }
        }
        catch (error) {
            log.warning(`error syncing jobs. ${error.message}`, { component });
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
        let syncResult;
        try {
            const result = await stateManager.createAlgorithms(list);
            log.info(`algorithms: synced ${result?.inserted || 0} to db`, { component });
            await this._deleteEtcdPrefix('algorithms', '/algorithms/store');
            await this._deleteEtcdPrefix('algorithms', '/algorithms/versions');
            await this._deleteEtcdPrefix('algorithms', '/algorithms/builds');
            await this._deleteStoragePrefix(type);
        }
        catch (error) {
            this._handleDuplicateKeyErrors(error);
        }
        finally {
            // In case algorithms already exist in db, check if a new version needs to be added
            syncResult = await this._syncAlgorithmsData(list);
        }
        return syncResult;
    }

    async _syncAlgorithmsData(algorithmList) {
        let etcd_versionsCount = 0;
        let versionsCount = 0;
        let buildsCount = 0;
        let addedVersionsCount = 0;
        const limit = 1000;

        for (const algorithm of algorithmList) {
            const { name } = algorithm;
            const etcd_versions = await stateManager._etcd.algorithms.versions.list({ name, limit });
            const versions = await stateManager.getVersions({ name, limit }, true);

            if (etcd_versions.length) {
                etcd_versionsCount += etcd_versions.length;
                await stateManager.createVersions(etcd_versions);
            }

            const algo = await stateManager.getAlgorithm({ name });
            if (!algo.version) {  // occurs when algo was just created (either when it has versions in the past, or first time creation)
                const userName = keycloak.getPreferredUsername();
                const newVersion = await algorithmsVersionsService.createVersion(algorithm, undefined, userName);
                await algorithmsVersionsService.applyVersion({ name, version: newVersion, force: true });
                addedVersionsCount++;
                versionsCount += versions.length; // Including previous versions if there are any.
            }

            const builds = await stateManager._etcd.algorithms.builds.list({ name, limit });
            if (builds.length) {
                buildsCount += builds.length;
                await stateManager.createBuilds(builds);
            }
        }
        let message = "";
        if (addedVersionsCount > 0) {
            message += `Algorithms: Added ${addedVersionsCount} versions and synced ${versionsCount} versions.`;
        }
        if (etcd_versionsCount > 0) {
            message += message === "" ? "" : " ";
            message += `Synced ${etcd_versionsCount} versions from etcd.`;
        }
        if (buildsCount > 0) {
            message += message === "" ? "" : " ";
            message += `Created ${buildsCount} builds from etcd.`;
        }
        return message === "" ? `Algorithms are already synced.` : message;
    }

    _logSyncSuccess(type, resultMessage) {
        log.info(`${type}s syncing succeed: ${resultMessage}`, { component });
    }

    _logSyncFailed(type, error) {
        log.warning(`${type}s: syncing failed. ${error.message}`, { component });
    }

    async _pipelineDriversTemplate(options) {
        try {
            const driversTemplate = drivers.map(d => ({ ...d, ...options.pipelineDriversResources }));
            await Promise.all(driversTemplate.map(d => stateManager.setPipelineDriversSettings(d)));
            await this._deleteEtcdPrefix('pipelineDrivers', '/pipelineDrivers/store');
        }
        catch (error) {
            log.warning(`pipelineDrivers: failed to upload default drivers. ${error.message} `, { component });
        }
    }

    async _createPipelines(type, list) {
        let syncResult;
        try {
            await stateManager.createPipelines(list);
            await this._deleteEtcdPrefix('pipelines', '/pipelines/store');
            await this._deleteStoragePrefix(type);
        }
        catch (error) {
            this._handleDuplicateKeyErrors(error);
        }
        finally {
            // In case pipelines exist in db, createPipelines will fail but syncing is needed any case.
            syncResult = await this._syncPipelinesData(list);
        }
        return syncResult;
    }

    async _syncPipelinesData(pipelineList) {
        let versionsCount = 0;
        let addedVersionsCount = 0;
        const limit = 1000;

        for (const pipeline of pipelineList) {
            const { name } = pipeline;
            const versions = await stateManager.getVersions({ name, limit }, true);
            const pipe = await stateManager.getPipeline({ name });
            if (!pipe.version) {
                const userName = keycloak.getPreferredUsername();
                const newVersion = await pipelinesVersionsService.createVersion(pipe, undefined, userName);
                await pipelinesVersionsService.applyVersion({ name, version: newVersion, force: true });
                addedVersionsCount++;
                versionsCount += versions.length; // Including previous versions if there are any.
            }
        }
        return addedVersionsCount === 0 ? `Pipelines are already synced.` : `Pipelines: Added ${addedVersionsCount} versions and synced ${versionsCount} versions.`;
    }

    async _createExperiments(type, list) {
        let duplicateCount = 0;
        let syncResult;
        try {
            await stateManager.createExperiments(list);
            await this._deleteEtcdPrefix('experiments', '/experiment');
            await this._deleteStoragePrefix(type);
        }
        catch (error) {
            duplicateCount = this._handleDuplicateKeyErrors(error);
        }
        finally {
            const experimentsAdded = list.length - duplicateCount;
            syncResult = experimentsAdded === 0 ? `Experiments are already synced.` : `Experiments: Added ${experimentsAdded} experiments.`;
        }
        return syncResult;
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
        log.info(`${type}: clean etcd path "${path}" deleted ${result.deleted} keys`, { component });
    }

    async _deleteStoragePrefix(type) {
        await storageManager.hkubeStore.delete({ type });
        log.info(`${type}s: clean storage path "${type}"`, { component });
    }

    // Filters out duplicate key errors and throws if there are other errors
    _handleDuplicateKeyErrors(error) {
        const all_error_messages = error?.writeErrors?.map(e => e.err?.errmsg || e.errmsg) || [];

        // Ignore duplicate key errors
        const filtered_errors = all_error_messages.filter(
            msg => !msg.includes('E11000 duplicate key error')
        );

        if (filtered_errors.length > 0) {
            const filteredError = new Error(
                `Non-duplicate errors occurred during sync:\n${filtered_errors.join('\n')}`
            );
            filteredError.writeErrors = filtered_errors;
            throw filteredError;
        }
        return all_error_messages.length - filtered_errors.length;
    }
}

module.exports = new PipelinesUpdater();
