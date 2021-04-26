const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGateway(gateway) {
        this._validator.validate(this._validator.definitions.gateway, gateway, true);
    }

    async validateGatewayExists({ name }) {
        const result = await stateManager.getGateway({ name });
        if (!result) {
            throw new ResourceNotFoundError('gateway', name);
        }
    }
}

module.exports = ApiValidator;
