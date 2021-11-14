const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCreateDevenv(options) {
        this._validator.validate(this._validator.definitions.createDevenvRequest, options);
        this._validator.addDefaults(this._validator.definitions.createDevenvRequest, options);
    }
    
    validateGetDevenv(options) {
        if (!options?.name){
            throw new InvalidDataError('name is required');
        }
    }

    validateDeleteDevenv(options) {
        if (!options?.name){
            throw new InvalidDataError('name is required');
        }
    }
}

module.exports = ApiValidator;
