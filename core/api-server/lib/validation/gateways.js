const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGatewayName(gateway) {
        this._validator.validate(this._validator.definitions.gateway, gateway, true);
    }

    async validateGatewayExists(pipeline) {
        const { gatewayName } = pipeline;
        const result = await stateManager.getGateway({ name: gatewayName });
        if (!result) {
            throw new ResourceNotFoundError('gateway', gatewayName);
        }
    }
}

module.exports = ApiValidator;
