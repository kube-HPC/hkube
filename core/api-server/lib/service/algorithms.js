
const merge = require('lodash.merge');
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const executionService = require('./execution');
const pipelineService = require('./pipelines');
const stateManager = require('../state/state-manager');
const buildsService = require('./builds');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');
const { MESSAGES, BUILD_TYPES } = require('../consts/builds');
const gitDataAdapter = require('./githooks/git-data-adapter');

class AlgorithmStore {
    async updateAlgorithm(options) {
        validator.validateAlgorithmName(options);
        const alg = await stateManager.getAlgorithm(options);
        if (!alg) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options, options: { overrideImage: true } });
        return algorithm;
    }

    async deleteAlgorithm(options) {
        validator.validateAlgorithmDelete(options);
        const { name, force } = options;
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }

        const { builds, versions, pipelines, executions } = await this._findAlgorithmDependencies(name);
        const { message, details } = await this._checkAlgorithmDependencies({ name, builds, versions, pipelines, executions });
        let summary = `algorithm ${name} successfully deleted from store`;
        if (message) {
            if (!force) {
                throw new ActionNotAllowed(message, details);
            }
            else {
                const buildsRes = await this._deleteAll(builds, (a) => stateManager.deleteBuild(a));
                const versionRes = await this._deleteAll(versions, (a) => stateManager.deleteAlgorithmVersion(a));
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
        await storageManager.hkubeStore.delete({ type: 'algorithm', name });
        await stateManager.deleteAlgorithm({ name });
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
            stateManager.getBuilds({ buildId: name, limit }, n => n.algorithmName === name),
            stateManager.getAlgorithmVersions({ name, limit }, n => n.name === name),
            stateManager.getPipelines({ limit }, this._findAlgorithmInNodes(name)),
            stateManager.getRunningPipelines({ limit }, this._findAlgorithmInNodes(name))
        ]);
        return { builds, versions, pipelines, executions };
    }

    _findAlgorithmInNodes(algorithmName) {
        return (l => l.nodes && l.nodes.some(n => n.algorithmName === algorithmName));
    }

    async getAlgorithm(options) {
        validator.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return algorithm;
    }

    async getAlgorithms(options) {
        return stateManager.getAlgorithms(options);
    }

    async storeAlgorithm(options) {
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        await stateManager.setAlgorithm(options);
    }

    async insertAlgorithm(options) {
        validator.validateAlgorithmName(options);
        const alg = await stateManager.getAlgorithm(options);
        if (alg) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload: options });
        return algorithm;
    }

    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }

    // TODO: need to refactor this function to override image in a right way
    async applyAlgorithm(data) {
        const { payload, options } = data;
        const file = data.file || {};
        let buildId;
        let newAlgorithm;
        let algorithmImage;
        const messages = [];

        try {
            const { overrideImage } = options || {};
            validator.validateApplyAlgorithm(payload);

            const oldAlgorithm = await stateManager.getAlgorithm(payload);
            if (oldAlgorithm) {
                algorithmImage = overrideImage ? payload.algorithmImage : oldAlgorithm.algorithmImage;
                if (oldAlgorithm.type !== payload.type) {
                    throw new InvalidDataError(`algorithm type cannot be changed, new type: ${payload.type}, old type: ${oldAlgorithm.type}`);
                }
            }

            newAlgorithm = merge({}, oldAlgorithm, payload);
            validator.addAlgorithmDefaults(newAlgorithm);

            if (payload.type === BUILD_TYPES.CODE && file.path) {
                if (payload.algorithmImage) {
                    throw new InvalidDataError(MESSAGES.FILE_AND_IMAGE);
                }
                const result = await buildsService.createBuild(file, oldAlgorithm, payload);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = merge({}, newAlgorithm, result.algorithm);
            }
            else if (payload.type === BUILD_TYPES.GIT && payload.gitRepository) {
                if (payload.algorithmImage) {
                    throw new InvalidDataError(MESSAGES.GIT_AND_IMAGE);
                }
                newAlgorithm = await gitDataAdapter.getInfoAndAdapt(newAlgorithm);
                const result = await buildsService.createBuildFromGitRepository(oldAlgorithm, newAlgorithm);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = merge({}, newAlgorithm, result.algorithm);
            }

            if (!newAlgorithm.algorithmImage && !newAlgorithm.fileInfo && !newAlgorithm.gitRepository) {
                throw new InvalidDataError(MESSAGES.APPLY_ERROR);
            }
            if (!newAlgorithm.algorithmImage && buildId) {
                newAlgorithm.options.pending = true;
            }

            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            await this._versioning(overrideImage, oldAlgorithm, newAlgorithm, payload);
            newAlgorithm = merge({}, newAlgorithm, { algorithmImage });
            await this.storeAlgorithm(newAlgorithm);
        }
        finally {
            buildsService.removeFile(data.file);
        }
        return { buildId, messages, algorithm: newAlgorithm };
    }

    async _versioning(overrideImage, oldAlgorithm, newAlgorithm, payload) {
        if (oldAlgorithm && oldAlgorithm.algorithmImage !== payload.algorithmImage) {
            if (overrideImage) {
                await stateManager.setAlgorithmVersion(oldAlgorithm);
            }
            else {
                await stateManager.setAlgorithmVersion(newAlgorithm);
            }
        }
    }
}

module.exports = new AlgorithmStore();
