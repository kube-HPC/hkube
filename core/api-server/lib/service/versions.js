const validator = require('../validation/api-validator');
const algorithms = require('./algorithms');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.validateAlgorithmName(options);
        const algorithmVersion = await stateManager.getAlgorithmVersions(options);
        return algorithmVersion;
    }

    async applyVersion(options) {
        const { name, image, force } = options;
        validator.validateAlgorithmVersion({ name, image });
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const algorithmVersion = await stateManager.getAlgorithmVersion({ name, algorithmImage: image });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', image);
        }

        if (!force) {
            const runningPipelines = await stateManager.getRunningPipelines();
            const matchedPipelines = runningPipelines.filter(e => e.nodes.find(n => n.algorithmName === options.name));
            if (matchedPipelines.length > 0) {
                throw new ActionNotAllowed(`there are ${matchedPipelines.length} running pipelines which dependent on "${options.name}" algorithm`, matchedPipelines.map(p => p.jobId));
            }
        }
        await algorithms.storeAlgorithm(algorithmVersion);
        return algorithmVersion;
    }

    async deleteVersion(options) {
        const { name, image } = options;
        validator.validateAlgorithmVersion({ name, image });
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        if (algorithm.algorithmImage === image) {
            throw new ActionNotAllowed('unable to remove used version');
        }
        const algorithmVersion = await stateManager.getAlgorithmVersion({ name, algorithmImage: image });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', image);
        }
        const res = await stateManager.deleteAlgorithmVersion({ name, algorithmImage: image });
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
    }
}

module.exports = new AlgorithmVersions();
