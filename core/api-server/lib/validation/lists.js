class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateResultList(pipeline) {
        this._validator.validate(this._validator.definitions.queryList, pipeline, true);
    }

    validateListRange(options) {
        this._validator.validate(this._validator.definitions.queryRange, options);
    }
}

module.exports = ApiValidator;
