const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const algorithmStore = require('./algorithms-store');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.algorithms.validateAlgorithmName(options);
        const algorithmVersion = await stateManager.algorithms.versions.list(options);
        return algorithmVersion;
    }

    async tagVersion(options) {
        const { name, id, pinned, tags } = options;
        validator.algorithms.validateAlgorithmTag(options);
        const version = await this.getVersion({ name, id });
        await stateManager.algorithms.versions.set({ name, id, pinned, tags });
        return version;
    }

    async applyVersion(options) {
        const { name, id, force } = options;
        validator.algorithms.validateAlgorithmVersion(options);
        const version = await this.getVersion({ name, id });
        if (!force) {
            const runningPipelines = await stateManager.executions.running.list(null, e => e.nodes.find(n => n.algorithmName === name));
            if (runningPipelines.length > 0) {
                throw new ActionNotAllowed(`there are ${runningPipelines.length} running pipelines which dependent on "${options.name}" algorithm`, runningPipelines.map(p => p.jobId));
            }
        }
        await algorithmStore.storeAlgorithm(version);
        return version;
    }

    async getVersion({ name, id }) {
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const version = await stateManager.algorithms.versions.get({ name, id });
        if (!version) {
            throw new ResourceNotFoundError('version', id);
        }
        return version;
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

    async createVersion(algorithm) {
        await stateManager.algorithms.versions.create(algorithm);
    }
}

module.exports = new AlgorithmVersions();
