
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.validateAlgorithmName(options.name);
        const algorithmVersion = await stateManager.getAlgorithmVersions(options);
        return algorithmVersion;
    }

    async apply(options) {
        validator.validateAlgorithmVersion(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const algorithmVersion = await stateManager.getAlgorithmVersion(options);
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', options.algorithmImage);
        }
        await storageManager.hkubeStore.put({ type: 'algorithm', name: options.name, data: algorithmVersion });
        await stateManager.setAlgorithm(algorithmVersion);
        return algorithmVersion;
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

    _versioning(oldAlgorithm, newAlgorithm) {
        const versions = newAlgorithm.versions || [];
        if (oldAlgorithm && oldAlgorithm.algorithmImage !== newAlgorithm.algorithmImage) {
            versions.push(oldAlgorithm);
        }
        return { ...newAlgorithm, versions };
    }
}

module.exports = new AlgorithmVersions();
