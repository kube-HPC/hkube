const validator = require('../validation/api-validator');
const algorithms = require('./algorithms');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.validateAlgorithmName(options);
        const algorithmVersion = await stateManager.getAlgorithmVersions(options);
        return algorithmVersion;
    }

    async applyVersion(options) {
        validator.validateAlgorithmVersion(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const algorithmVersion = await stateManager.getAlgorithmVersion(options);
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', options.algorithmImage);
        }
        await algorithms.storeAlgorithm(algorithmVersion);
        return algorithmVersion;
    }

    async deleteVersion(options) {
        const res = await stateManager.deleteAlgorithmVersion(options, { isPrefix: !options.algorithmImage });
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
    }
}

module.exports = new AlgorithmVersions();
