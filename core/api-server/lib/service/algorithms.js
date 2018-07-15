
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError } = require('../errors');

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
        await this._findAlgorithmDependency(options.name);
        return stateManager.deleteAlgorithm(options);
    }

    async _findAlgorithmDependency(algorithmName) {
        const limit = 1000;
        const pipelines = await stateManager.getPipelines({ limit });
        let result = this._findAlgorithm(pipelines, algorithmName);
        if (result.length > 0) {
            throw new InvalidDataError(`${algorithmName} is stored in ${result.length} different pipelines`);
        }

        const executions = await stateManager.getExecutionsList({ limit });
        result = this._findAlgorithm(executions, algorithmName);
        if (result.length > 0) {
            throw new InvalidDataError(`${algorithmName} is running in ${result.length} different pipelines`);
        }
    }

    _findAlgorithm(list, algorithmName) {
        return list.filter(l => l.nodes && l.nodes.filter(n => n.algorithmName === algorithmName));
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
