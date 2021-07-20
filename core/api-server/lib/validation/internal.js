class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateStoredInternal(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false);
    }

    validateRawSubPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.codeApiPipelineRequest, pipeline, false);
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false);
    }

    validateStoredSubPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.codeApiPipelineRequest, pipeline, false);
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false);
    }
}

module.exports = ApiValidator;
