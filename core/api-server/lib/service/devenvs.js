const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError } = require('../errors');
class Devenvs {
    async get(options) {
        validator.devenvs.validateGetDevenv(options);
        const { name } = options;
        const response = await stateManager.getDevenv({ name });
        if (!response) {
            throw new ResourceNotFoundError('devenv', name);
        }
        return response;
    }

    async list() {
        const response = await stateManager.getDevenvs();
        return response;
    }

    async create(options) {
        validator.devenvs.validateCreateDevenv(options);
        const response = await stateManager.createDevenv(options);
        return response;
    }

    async delete(options) {
        validator.devenvs.validateDeleteDevenv(options);
        const { name } = options;
        const response = await stateManager.deleteDevenv({ name });
        return response;
    }
}

module.exports = new Devenvs();
