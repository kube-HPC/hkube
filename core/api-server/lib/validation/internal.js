class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateStoredInternal(pipeline) {
        this._validator.validate(this._validator.definitionsInternal.pipeline, pipeline, false);
    }

    validateRawSubPipeline(pipeline) {
        this._validator.validate(this._validator.definitionsInternal.rawSubPipeline, pipeline, false);
    }

    validateStoredSubPipeline(pipeline) {
        this._validator.validate(this._validator.definitionsInternal.storedSubPipeline, pipeline, false);
    }
}

module.exports = ApiValidator;
