
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
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        await stateManager.setAlgorithm(options);
        return options;
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

    async getAlgorithms() {
        return stateManager.getAlgorithms();
    }

    async insertAlgorithm(options) {
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (algorithm) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        await stateManager.setAlgorithm(options);
        return options;
    }

    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }

    async applyAlgorithm(options) {
        const { payload } = options;
        let buildId;
        const messages = [];
        try {
            validator.validateUpdateAlgorithm(payload);
            const oldAlgorithm = await stateManager.getAlgorithm(payload);
            let newAlgorithm = payload;

            if (options.file && options.file.path) {
                const result = await builds.createBuild(options.file, oldAlgorithm, newAlgorithm);
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
                newAlgorithm = result.algorithm;
            }
            else if (payload.type === BUILD_TYPES.GIT) {
                let updatedPayload = payload;
                if (!oldAlgorithm) {
                    updatedPayload = await gitDataAdapter.getInfoAndAdapt(options);
                }
                const result = await builds.createBuildFromGitRepository({ ...updatedPayload });
                buildId = result.buildId; // eslint-disable-line
                messages.push(...result.messages);
            }
            else {
                messages.push(MESSAGES.NO_FILE_FOR_BUILD);
            }

            if (buildId && payload.algorithmImage) {
                throw new InvalidDataError(MESSAGES.FILE_AND_IMAGE);
            }

            newAlgorithm = { ...oldAlgorithm, ...newAlgorithm };
            if (!newAlgorithm.algorithmImage && !(options.file && options.file.path) && !newAlgorithm.gitRepository) {
                throw new InvalidDataError(MESSAGES.APPLY_ERROR);
            }
            if (!newAlgorithm.algorithmImage && buildId) {
                newAlgorithm.options.pending = true;
            }
            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
            await stateManager.setAlgorithm(newAlgorithm);
        }
        finally {
            builds.removeFile(options.file);
        }
        return { buildId, messages };
    }
}

module.exports = new AlgorithmStore();
