const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, } = require('../errors/errors');

class AlgorithmStore {
    /**
     * update algorithm
     * update the given algorithm.
     *
     * */
    async updateAlgorithm(options) {
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return stateManager.setAlgorithm(options);
    }

    /**
     * delete stored algorithm
     * removes selected stored algorithm from store
     *
     * */
    async deleteAlgorithm(options) {
        validator.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return stateManager.deleteAlgorithm(options);
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
        return stateManager.setAlgorithm(options);
    }
}

module.exports = new AlgorithmStore();
