
const format = require('string-template');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const builds = require('./builds');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');

class AlgorithmStore {
    async updateAlgorithm(options) {
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
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
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: options });
        const algorithm = await stateManager.getAlgorithm(options);
        if (algorithm) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        await stateManager.setAlgorithm(options);
        return options;
    }

    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }

    async applyAlgorithm(options) {
        const { payload, file } = options;
        let buildId;
        const messages = [];
        try {
            validator.validateUpdateAlgorithm(payload);
            const oldAlgorithm = await stateManager.getAlgorithm(payload);
            let newAlgorithm = payload;

            if (file.path) {
                const result = await builds.createBuild(file, oldAlgorithm, newAlgorithm);
                buildId = result.buildID;
                messages.push(...result.messages);
                newAlgorithm = result.algorithm;
            }
            else {
                messages.push(MESSAGES.NO_FILE_FOR_BUILD);
            }

            if (buildId && payload.algorithmImage) {
                throw new InvalidDataError(MESSAGES.FILE_AND_IMAGE);
            }

            newAlgorithm = Object.assign({}, oldAlgorithm, newAlgorithm);
            if (!newAlgorithm.algorithmImage && !file.path) {
                throw new InvalidDataError(MESSAGES.APPLY_ERROR);
            }
            if (!newAlgorithm.algorithmImage && buildId) {
                newAlgorithm.options.pending = true;
            }
            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            await stateManager.setAlgorithm(newAlgorithm);
        }
        finally {
            builds.removeFile(file);
        }
        return { buildId, messages };
    }
}

module.exports = new AlgorithmStore();
