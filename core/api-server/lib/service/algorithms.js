
const merge = require('lodash.merge');
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const builds = require('./builds');
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
        validator.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        await this._checkAlgorithmDependencies(options.name);
        await storageManager.hkubeStore.delete({ type: 'algorithm', name: options.name });
        return stateManager.deleteAlgorithm(options);
    }

    async _checkAlgorithmDependencies(algorithmName) {
        const { pipelines, executions } = await this._findAlgorithmDependencies(algorithmName);
        const messages = [];
        if (pipelines.length > 0) {
            messages.push(`algorithm ${algorithmName} is stored in ${pipelines.length} different pipelines`);
        }
        if (executions.length > 0) {
            messages.push(`algorithm ${algorithmName} is running in ${executions.length} different executions`);
        }
        if (messages.length > 0) {
            messages.push(`before you delete algorithm ${algorithmName} you must first delete all related pipelines and executions`);
            throw new ActionNotAllowed(messages.join(', '), {
                pipelines: pipelines.map(p => p.name),
                executions: executions.map(e => e.jobId)
            });
        }
    }

    async _findAlgorithmDependencies(algorithmName) {
        const limit = 1000;
        const [pipelines, executions] = await Promise.all([
            stateManager.getPipelines({ limit }, this._findAlgorithm(algorithmName)),
            stateManager.getRunningPipelines({ limit }, this._findAlgorithm(algorithmName))
        ]);
        return { pipelines, executions };
    }

    _findAlgorithm(algorithmName) {
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
                const result = await builds.createBuild(file, oldAlgorithm, payload);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = merge({}, newAlgorithm, result.algorithm);
            }
            else if (payload.type === BUILD_TYPES.GIT && payload.gitRepository) {
                if (payload.algorithmImage) {
                    throw new InvalidDataError(MESSAGES.GIT_AND_IMAGE);
                }
                newAlgorithm = await gitDataAdapter.getInfoAndAdapt(newAlgorithm);
                const result = await builds.createBuildFromGitRepository(oldAlgorithm, newAlgorithm);
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
            builds.removeFile(data.file);
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
