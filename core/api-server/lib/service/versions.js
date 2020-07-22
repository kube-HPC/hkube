const validator = require('../validation/api-validator');
const algorithms = require('./algorithms');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.algorithms.validateAlgorithmName(options);
        const algorithmVersion = await stateManager.algorithms.versions.list(options);
        return algorithmVersion;
    }

    async applyVersion(options) {
        const { name, image, force } = options;
        validator.algorithms.validateAlgorithmVersion({ name, image });
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const algorithmVersion = await stateManager.algorithms.versions.get({ name, algorithmImage: image });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', image);
        }

        if (!force) {
            const runningPipelines = await stateManager.executions.running.list(null, e => e.nodes.find(n => n.algorithmName === options.name));
            if (runningPipelines.length > 0) {
                throw new ActionNotAllowed(`there are ${runningPipelines.length} running pipelines which dependent on "${options.name}" algorithm`, runningPipelines.map(p => p.jobId));
            }
        }
        await algorithms.storeAlgorithm(algorithmVersion);
        return algorithmVersion;
    }

    async deleteVersion(options) {
        const { name, image } = options;
        validator.algorithms.validateAlgorithmVersion({ name, image });
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        if (algorithm.algorithmImage === image) {
            throw new ActionNotAllowed('unable to remove used version');
        }
        const algorithmVersion = await stateManager.algorithms.versions.get({ name, algorithmImage: image });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('algorithmVersion', image);
        }
        const res = await stateManager.algorithms.versions.delete({ name, algorithmImage: image });
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
    }
}

module.exports = new AlgorithmVersions();
