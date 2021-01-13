const merge = require('lodash.merge');
const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const { buildTypes } = require('@hkube/consts');
const executionService = require('./execution');
const stateManager = require('../state/state-manager');
const buildsService = require('./builds');
const versionsService = require('./versions');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');

class AlgorithmStore {
    init(config) {
        this._debugUrl = config.debugUrl.path;

        stateManager.onBuildComplete(async (build) => {
            /**
             * this code runs after a successful build.
             * first, we create a new version, then if there are no versions,
             * we update the current algorithm with the new build image.
             */
            const { buildId, algorithm, algorithmName: name, algorithmImage } = build;
            const versions = await stateManager.getVersions({ name });
            const newAlgorithm = merge({}, algorithm, { algorithmImage, options: { pending: false } });
            const version = await versionsService.createVersion(newAlgorithm, buildId);

            if (versions.length === 0) {
                await stateManager.updateAlgorithm({ ...newAlgorithm, version });
            }
        });
    }

    async getAlgorithm(options) {
        validator.jobs.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return algorithm;
    }

    async getAlgorithms(options) {
        const { name, sort, limit } = options || {};
        return stateManager.getAlgorithms({ name, sort, limit });
    }

    async insertAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const alg = await stateManager.getAlgorithm(options);
        if (alg) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options });
        return algorithm;
    }

    async updateAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const alg = await stateManager.getAlgorithm(options);
        if (!alg) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options });
        return algorithm;
    }

    async deleteAlgorithm(options) {
        validator.algorithms.validateAlgorithmDelete(options);
        const { name, force } = options;
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }

        const { versions, pipelines, executions } = await this._findAlgorithmDependencies(name);

        if (!force && (pipelines.length > 0 || executions.length > 0)) {
            const { message, details } = await this._checkAlgorithmDependencies({ name, pipelines, executions });
            throw new ActionNotAllowed(message, details);
        }
        else {
            const result = await stateManager.deleteAlgorithm({ name });
            const buildPaths = versions.filter(v => v.fileInfo).map(v => v.fileInfo.path);
            await this._deleteAll(buildPaths, (a) => storageManager.delete({ path: a }));
            const pipelineRes = await stateManager.deletePipelines({ names: pipelines.map(p => p.name) });
            const execRes = await this._deleteAll(executions, (a) => executionService.stopJob(a));

            const entities = {
                builds: result.builds,
                versions: result.versions,
                readme: result.readme,
                pipelines: pipelineRes.deleted,
                executions: execRes.length
            };
            const deletedText = this._entitiesToText(entities);
            const summary = `algorithm ${name} successfully deleted from store. related data deleted: ${deletedText}`;
            return summary;
        }
    }

    async _deleteAll(array, func) {
        const res = await Promise.all(array.map(a => this._deleteEntity(func, a)));
        return res.filter(a => a);
    }

    _entitiesToText(entities) {
        return Object.entries(entities).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ');
    }

    async _deleteEntity(func, item) {
        let success = true;
        try {
            await func(item);
        }
        catch (e) {
            success = false;
        }
        return success;
    }

    async _checkAlgorithmDependencies({ name, ...entities }) {
        let message;
        const details = this._entitiesToText(entities);

        if (details) {
            message = `algorithm ${name} is stored in ${details}. you must first delete all related data or use the force flag`;
        }
        return { message, details };
    }

    async _findAlgorithmDependencies(name) {
        const [versions, pipelines, executions] = await Promise.all([
            stateManager.getVersions({ name, fields: { fileInfo: true } }),
            stateManager.searchPipelines({ algorithmName: name }),
            stateManager.searchJobs({ algorithmName: name, hasResult: false, fields: { jobId: true } })
        ]);
        return { versions, pipelines, executions };
    }

    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }

    /**
     * This method is responsible for create builds, versions, debug data and update algorithm.
     * This method update algorithm if one of the following conditions is valid:
     * 1. The update include new algorithm which is not exists in store.
     * 2. The update explicitly include to override current image.
     *
     */
    async applyAlgorithm(data) {
        const messages = [];
        const { forceUpdate, forceBuild } = data.options || {};
        const { version, created, modified, ...payload } = data.payload;
        const file = { path: data.file?.path, name: data.file?.originalname };

        validator.algorithms.validateApplyAlgorithm(payload);
        const oldAlgorithm = await stateManager.getAlgorithm(payload);
        const newAlgorithm = this._mergeAlgorithm(oldAlgorithm, payload);

        if (!payload.type) {
            newAlgorithm.type = this._resolveType(newAlgorithm, file.path);
        }
        if (oldAlgorithm && oldAlgorithm.type !== newAlgorithm.type) {
            throw new InvalidDataError(`algorithm type cannot be changed from "${oldAlgorithm.type}" to "${newAlgorithm.type}"`);
        }
        await this._validateAlgorithm(newAlgorithm);
        const hasDiff = this._compareAlgorithms(newAlgorithm, oldAlgorithm);
        const buildId = await buildsService.tryToCreateBuild(oldAlgorithm, newAlgorithm, file, forceBuild, messages);

        this._validateApplyParams(newAlgorithm);
        if (!newAlgorithm.algorithmImage && buildId && !oldAlgorithm) {
            newAlgorithm.options.pending = true;
        }
        if (newAlgorithm.options.debug) {
            newAlgorithm.data = { ...newAlgorithm.data, path: `${this._debugUrl}/${newAlgorithm.name}` };
        }

        const newVersion = await this._versioning(hasDiff, newAlgorithm, buildId);
        if (newVersion) {
            newAlgorithm.version = newVersion;
            messages.push(format(MESSAGES.VERSION_CREATED, { algorithmName: newAlgorithm.name }));
        }

        const hasVersion = !!newVersion || buildId;
        const shouldStoreOverride = (forceUpdate && hasVersion); // has version, but explicitly requested to override
        const shouldStoreFirstApply = !oldAlgorithm; // new algorithm that is not in the store

        if (shouldStoreOverride || shouldStoreFirstApply) {
            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            await stateManager.updateAlgorithm(newAlgorithm);
        }
        return { buildId, messages, algorithm: newAlgorithm };
    }

    _compareAlgorithms(oldAlgorithm, newAlgorithm) {
        if (!oldAlgorithm) {
            return true;
        }
        return !isEqual(oldAlgorithm, newAlgorithm);
    }

    _resolveType(payload, file) {
        if (file) {
            return buildTypes.CODE;
        }
        if (payload.gitRepository) {
            return buildTypes.GIT;
        }
        return payload.type || buildTypes.IMAGE;
    }

    _validateApplyParams(newAlgorithm) {
        if (!newAlgorithm.options.debug && !newAlgorithm.algorithmImage && !newAlgorithm.fileInfo && !newAlgorithm.gitRepository) {
            throw new InvalidDataError(MESSAGES.APPLY_ERROR);
        }
    }

    async _validateAlgorithm(newAlgorithm) {
        validator.algorithms.addAlgorithmDefaults(newAlgorithm);
        await validator.algorithms.validateAlgorithmResources(newAlgorithm);
    }

    _mergeAlgorithm(oldAlgorithm, payload) {
        const old = cloneDeep(oldAlgorithm);
        return { ...old, ...payload };
    }

    async _versioning(hasDiff, algorithm, buildId) {
        let version;
        if (hasDiff && algorithm.algorithmImage && !buildId) {
            version = await versionsService.createVersion(algorithm);
        }
        return version;
    }
}

module.exports = new AlgorithmStore();
