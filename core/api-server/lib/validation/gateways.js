class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGateway(gateway) {
        this._validator.validate(this._validator.definitions.gateway, gateway, true);
    }
}

module.exports = ApiValidator;
