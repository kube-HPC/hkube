
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed } = require('../errors');

class AlgorithmStore {
    /**
     * update algorithm
     * */
    async updateAlgorithm(options) {
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        await stateManager.setAlgorithm(options);
        return options;
    }

    /**
     * delete stored algorithm
     * */
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

    /**
     * get algorithms data from store
     * returns stored algorithm
     *
     * */
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

    /**
     * add an algorithm
     * adds the given algorithm to the store.
     *
     * */
    async insertAlgorithm(options) {
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (algorithm) {
            throw new ResourceExistsError('algorithm', options.name);
        }
        await stateManager.setAlgorithm(options);
        return options;
    }

    /**
     * get current algorithms queue from etcd
     */
    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }
}

module.exports = new AlgorithmStore();
