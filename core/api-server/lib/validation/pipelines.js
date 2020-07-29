class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateUpdatePipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, true);
    }

    validatePipelineName(name) {
        this._validator.validate(this._validator.definitions.pipelineName, name, false);
    }
}

module.exports = ApiValidator;
