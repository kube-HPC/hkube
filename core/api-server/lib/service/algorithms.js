const merge = require('lodash.merge');
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const { buildTypes, buildStatuses } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContanier();
const executionService = require('./execution');
const pipelineService = require('./pipelines');
const stateManager = require('../state/state-manager');
const buildsService = require('./builds');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
const gitDataAdapter = require('./githooks/git-data-adapter');
const component = require('../consts/componentNames').ALGORITHMS_SERVICE;

class AlgorithmStore {
    init(config) {
        this._debugUrl = config.debugUrl.path;

        stateManager.algorithms.builds.on('change', async (build) => {
            if (build.status !== buildStatuses.COMPLETED) {
                return;
            }
            const { algorithmName, algorithmImage } = build;
            const algorithm = await stateManager.algorithms.store.get({ name: algorithmName });
            if (!algorithm) {
                log.error(`unable to find algorithm "${algorithmName}"`, { component });
                return;
            }

            let currentImage;
            const algorithmVersion = await stateManager.algorithms.versions.list({ name: algorithmName });
            if (algorithmVersion.length === 0) {
                currentImage = algorithmImage;
            }
            else {
                currentImage = algorithm.algorithmImage;
            }
            const newAlgorithm = merge({}, algorithm, { algorithmImage: currentImage, options: { pending: false } });
            await this.storeAlgorithm(newAlgorithm);
            await stateManager.algorithms.versions.set({ ...newAlgorithm, algorithmImage });
        });
    }

    async updateAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const alg = await stateManager.algorithms.store.get(options);
        if (!alg) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options, options: { overrideImage: true } });
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

    async storeAlgorithm(options) {
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        await stateManager.algorithms.store.set(options);
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

    async getAlgorithmsQueueList() {
        return stateManager.algorithms.queue.list();
    }

    // TODO: need to refactor this function to override image in a right way
    async applyAlgorithm(data) {
        const { payload, options } = data;
        const file = data.file || {};
        let buildId;
        let newAlgorithm;
        const messages = [];

        try {
            const { overrideImage } = options || {};
            validator.algorithms.validateApplyAlgorithm(payload);

            const oldAlgorithm = await stateManager.algorithms.store.get(payload);
            if (oldAlgorithm && oldAlgorithm.type !== payload.type) {
                throw new InvalidDataError(`algorithm type cannot be changed from "${oldAlgorithm.type}" to "${payload.type}"`);
            }

            newAlgorithm = { ...oldAlgorithm, ...payload };
            validator.algorithms.addAlgorithmDefaults(newAlgorithm);
            await validator.algorithms.validateAlgorithmResources(newAlgorithm);

            if (payload.type === buildTypes.CODE && file.path) {
                if (payload.algorithmImage) {
                    throw new InvalidDataError(MESSAGES.FILE_AND_IMAGE);
                }
                const result = await buildsService.createBuild(file, oldAlgorithm, payload);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = merge({}, newAlgorithm, result.algorithm);
            }
            else if (payload.type === buildTypes.GIT && payload.gitRepository) {
                if (payload.algorithmImage && !payload.gitRepository.webUrl) {
                    throw new InvalidDataError(MESSAGES.GIT_AND_IMAGE);
                }
                const gitRepository = await gitDataAdapter.getInfoAndAdapt(newAlgorithm);
                newAlgorithm.gitRepository = gitRepository;
                const result = await buildsService.createBuildFromGitRepository(oldAlgorithm, newAlgorithm);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = merge({}, newAlgorithm, result.algorithm);
            }

            if (!newAlgorithm.options.debug && !newAlgorithm.algorithmImage && !newAlgorithm.fileInfo && !newAlgorithm.gitRepository) {
                throw new InvalidDataError(MESSAGES.APPLY_ERROR);
            }
            if (!newAlgorithm.algorithmImage && buildId) {
                newAlgorithm.options.pending = true;
            }
            if (newAlgorithm.options.debug) {
                newAlgorithm.data = { ...newAlgorithm.data, path: `${this._debugUrl}/${newAlgorithm.name}` };
            }

            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            const version = await this._versioning(overrideImage, oldAlgorithm, newAlgorithm, payload);
            if (version) {
                messages.push(format(MESSAGES.VERSION_CREATED, { algorithmName: newAlgorithm.name }));
            }
            let { algorithmImage } = payload;
            if (oldAlgorithm && !overrideImage) {
                algorithmImage = oldAlgorithm.algorithmImage;
            }
            newAlgorithm = merge({}, newAlgorithm, { algorithmImage });
            await this.storeAlgorithm(newAlgorithm);
        }
        finally {
            buildsService.removeFile(data.file);
        }
        return { buildId, messages, algorithm: newAlgorithm };
    }

    async _versioning(overrideImage, oldAlgorithm, newAlgorithm, payload) {
        let version = false;
        if (!oldAlgorithm && newAlgorithm.algorithmImage) {
            await stateManager.algorithms.versions.set(newAlgorithm);
            version = true;
        }
        else if (oldAlgorithm && oldAlgorithm.algorithmImage && payload.algorithmImage && oldAlgorithm.algorithmImage !== payload.algorithmImage) {
            version = true;
            if (overrideImage) {
                await stateManager.algorithms.versions.set(oldAlgorithm);
            }
            else {
                await stateManager.algorithms.versions.set(newAlgorithm);
            }
        }
        return version;
    }
}

module.exports = new AlgorithmStore();
