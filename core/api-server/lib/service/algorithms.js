const merge = require('lodash.merge');
const isEqual = require('lodash.isequal');
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const { buildTypes, buildStatuses } = require('@hkube/consts');
const executionService = require('./execution');
const pipelineService = require('./pipelines');
const stateManager = require('../state/state-manager');
const buildsService = require('./builds');
const versionsService = require('./versions');
const algorithmStore = require('./algorithms-store');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
const gitDataAdapter = require('./githooks/git-data-adapter');

class AlgorithmStore {
    init(config) {
        this._debugUrl = config.debugUrl.path;

        stateManager.algorithms.builds.on('change', async (build) => {
            if (build.status !== buildStatuses.COMPLETED) {
                return;
            }
            /**
             * this code runs after a successful build.
             * first, we create a new version, then if there are no versions,
             * we update the current algorithm with the new build image.
             */
            const { algorithm, algorithmName: name, algorithmImage } = build;
            const versions = await stateManager.algorithms.versions.list({ name });
            const newAlgorithm = merge({}, algorithm, { algorithmImage, options: { pending: false } });
            const version = await versionsService.createVersion(newAlgorithm);

            if (versions.length === 0) {
                await algorithmStore.storeAlgorithm({ ...newAlgorithm, version });
            }
        });
    }

    async getAlgorithm(options) {
        validator.jobs.validateName(options);
        const algorithm = await stateManager.algorithms.store.get(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return algorithm;
    }

    async getAlgorithms(options) {
        const { limit } = options || {};
        return stateManager.algorithms.store.list({ ...options, limit: limit || 1000 });
    }

    async insertAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const alg = await stateManager.algorithms.store.get(options);
        if (alg) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options });
        return algorithm;
    }

    async updateAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const alg = await stateManager.algorithms.store.get(options);
        if (!alg) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options });
        return algorithm;
    }

    async deleteAlgorithm(options) {
        validator.algorithms.validateAlgorithmDelete(options);
        const { name, force } = options;
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }

        const { builds, versions, pipelines, executions } = await this._findAlgorithmDependencies(name);
        const { message, details } = await this._checkAlgorithmDependencies({ name, builds, versions, pipelines, executions });
        let summary = `algorithm ${name} successfully deleted from store`;
        if (message) {
            if (!force && (pipelines.length > 0 || executions.length > 0)) {
                throw new ActionNotAllowed(message, details);
            }
            else {
                const buildPaths = versions.filter(v => v.fileInfo).map(v => v.fileInfo.path);
                await this._deleteAll(buildPaths, (a) => storageManager.delete({ path: a }));
                const buildsRes = await this._deleteAll(builds, (a) => stateManager.algorithms.builds.delete(a));
                const versionRes = await this._deleteAll(versions, (a) => stateManager.algorithms.versions.delete(a));
                const pipelineRes = await this._deleteAll(pipelines, (a) => pipelineService.deletePipelineFromStore(a));
                const execRes = await this._deleteAll(executions, (a) => executionService.stopJob(a));

                const entities = {
                    builds: buildsRes,
                    versions: versionRes,
                    pipelines: pipelineRes,
                    executions: execRes
                };
                const deletedText = this._entitiesToText(entities);
                summary += `. related data deleted: ${deletedText}`;
            }
        }
        await storageManager.hkubeStore.delete({ type: 'readme/algorithms', name });
        await storageManager.hkubeStore.delete({ type: 'algorithm', name });
        await stateManager.algorithms.store.delete({ name });
        return summary;
    }

    async _deleteAll(array, func) {
        const res = await Promise.all(array.map(a => this._deleteEntity(func, a)));
        return res.filter(a => a);
    }

    _entitiesToText(entities) {
        return Object.entries(entities).filter(([, v]) => v.length).map(([k, v]) => `${v.length} ${k}`).join(', ');
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
        const limit = 1000;
        const [builds, versions, pipelines, executions] = await Promise.all([
            stateManager.algorithms.builds.list({ buildId: name, limit }, n => n.algorithmName === name),
            stateManager.algorithms.versions.list({ name, limit }, n => n.name === name),
            stateManager.pipelines.list({ limit }, this._findAlgorithmInNodes(name)),
            stateManager.executions.running.list({ limit }, this._findAlgorithmInNodes(name))
        ]);
        return { builds, versions, pipelines, executions };
    }

    _findAlgorithmInNodes(algorithmName) {
        return (l => l.nodes && l.nodes.some(n => n.algorithmName === algorithmName));
    }

    async getAlgorithmsQueueList() {
        return stateManager.algorithms.queue.list();
    }

    /**
     * This method is responsible for create builds, versions, debug data and update algorithm.
     * This method update algorithm if one of the following conditions is valid:
     * 1. The update include new algorithm which is not exists in store.
     * 2. The update didn't trigger any new version or build.
     * 3. The update explicitly include to override current image.
     *
     */
    async applyAlgorithm(data) {
        const file = data.file || {};
        const messages = [];
        const { setAsCurrent } = data.options || {};
        const { version, ...payload } = data.payload;

        validator.algorithms.validateApplyAlgorithm(payload);
        const oldAlgorithm = await this._getAlgorithm(payload);
        let newAlgorithm = this._mergeAlgorithm(oldAlgorithm, payload);
        await this._validateAlgorithm(newAlgorithm);
        const hasDiff = this._compareAlgorithms(newAlgorithm, oldAlgorithm);

        const buildInfo = await buildsService.shouldBuild(oldAlgorithm, newAlgorithm, file);

        if (payload.type === buildTypes.CODE && buildInfo.build) {
            await this._createBuildFromCode(newAlgorithm, buildInfo.build);
        }
        else if (payload.type === buildTypes.GIT && buildInfo.build) {
            await this._createBuildFromGit(newAlgorithm, buildInfo.build);
        }
        const buildId = buildInfo.build?.buildId;
        if (buildInfo.messages) {
            messages.push(...buildInfo.messages);
        }

        this._validateApplyParams(newAlgorithm);
        if (!newAlgorithm.algorithmImage && buildId && !oldAlgorithm) {
            newAlgorithm.options.pending = true;
        }
        if (newAlgorithm.options.debug) {
            newAlgorithm.data = { ...newAlgorithm.data, path: `${this._debugUrl}/${newAlgorithm.name}` };
        }

        const newVersion = await this._versioning(hasDiff, newAlgorithm);
        if (newVersion) {
            messages.push(format(MESSAGES.VERSION_CREATED, { algorithmName: newAlgorithm.name }));
        }
        let { algorithmImage } = payload;
        if (oldAlgorithm && !setAsCurrent) {
            algorithmImage = oldAlgorithm.algorithmImage;
        }
        newAlgorithm = merge({}, newAlgorithm, { algorithmImage }, { version: newVersion });

        const hasVersion = newVersion || buildId;
        // has version, but explicitly requested to override
        const shouldStoreOverride = (setAsCurrent && hasVersion);
        // no build and no version
        const shouldStoreNoVersionBuild = !hasVersion;
        // new algorithm that is not in the store
        const shouldStoreFirstApply = !oldAlgorithm;
        if (shouldStoreOverride || shouldStoreNoVersionBuild || shouldStoreFirstApply) {
            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            await algorithmStore.storeAlgorithm(newAlgorithm);
        }
        return { buildId, messages, algorithm: newAlgorithm };
    }

    _compareAlgorithms(oldAlgorithm, newAlgorithm) {
        if (!oldAlgorithm) {
            return true;
        }
        return !isEqual(oldAlgorithm, newAlgorithm);
    }

    async _createBuildFromGit(newAlgorithm, build) {
        if (newAlgorithm.algorithmImage && !newAlgorithm.gitRepository.webUrl) {
            throw new InvalidDataError(MESSAGES.GIT_AND_IMAGE);
        }
        await buildsService.createBuildFromGitRepository(build);
    }

    async _createBuildFromCode(newAlgorithm, build) {
        if (newAlgorithm.algorithmImage) {
            throw new InvalidDataError(MESSAGES.FILE_AND_IMAGE);
        }
        await buildsService.createBuildFromCode(build);
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
        const newAlgorithm = { ...oldAlgorithm, ...payload };
        return newAlgorithm;
    }

    async _getAlgorithm(payload) {
        const oldAlgorithm = await stateManager.algorithms.store.get(payload);
        if (oldAlgorithm && oldAlgorithm.type !== payload.type) {
            throw new InvalidDataError(`algorithm type cannot be changed from "${oldAlgorithm.type}" to "${payload.type}"`);
        }
        return oldAlgorithm;
    }

    async _versioning(hasDiff, algorithm) {
        let version;
        if (hasDiff && algorithm.algorithmImage) {
            version = await versionsService.createVersion(algorithm);
        }
        return version;
    }
}

module.exports = new AlgorithmStore();
