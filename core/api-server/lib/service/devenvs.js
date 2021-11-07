const storageManager = require('@hkube/storage-manager');
const { uid } = require('@hkube/uid');
const { boardStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
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

    async create(options){
        validator.devenvs.validateCreateDevenv(options);
        const { name } = options;
        const response = await stateManager.createDevenv({ name });
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
