const { devenvStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ResourceExistsError } = require('../errors');
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
        const devenv = await stateManager.getDevenv(options);
        if (devenv) {
            throw new ResourceExistsError('devenv', options.name);
        }
        const response = await stateManager.createDevenv({ ...options, status: devenvStatuses.PENDING });
        return response;
    }

    async delete(options) {
        validator.devenvs.validateDeleteDevenv(options);
        const { name } = options;
        const devenv = await stateManager.getDevenv({ name });
        if (!devenv) {
            throw new ResourceNotFoundError('devenv', name);
        }
        const response = await stateManager.markDeleteDevenv({ name });
        return response;
    }

    async stop(options) {
        validator.devenvs.validateDeleteDevenv(options);
        const { name } = options;
        const devenv = await stateManager.getDevenv({ name });
        if (!devenv) {
            throw new ResourceNotFoundError('devenv', name);
        }
        const response = await stateManager.stopDevenv({ name });
        return response;
    }

    async start(options) {
        validator.devenvs.validateDeleteDevenv(options);
        const { name } = options;
        const devenv = await stateManager.getDevenv({ name });
        if (!devenv || devenv.status !== devenvStatuses.STOPPED) {
            throw new ResourceNotFoundError('devenv', name);
        }
        const response = await stateManager.startDevenv({ name });
        return response;
    }
}

module.exports = new Devenvs();
