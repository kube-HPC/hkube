const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateRunRawPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false, { checkFlowInput: true });
    }

    validateRunStoredPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.storedPipelineRequest, pipeline, false);
    }

    validateCaching(request) {
        this._validator.validate(this._validator.definitions.caching, request, false);
    }

    validateExecAlgorithmRequest(request) {
        this._validator.validate(this._validator.definitions.execAlgorithmRequest, request, false);
    }

    addPipelineDefaults(pipeline) {
        this._validator.addDefaults(this._validator.definitions.pipeline, pipeline);
    }

    validatePipeline(pipeline, options = {}) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false, { checkFlowInput: true, ...options });
    }

    async validateConcurrentPipelines(pipeline) {
        if (pipeline.options && pipeline.options.concurrentPipelines) {
            const { amount, rejectOnFailure } = pipeline.options.concurrentPipelines;
            const { name, experimentName } = pipeline;
            const result = await stateManager.jobs.active.list();
            const pipelines = result.filter(r => r.pipeline === name && r.experiment === experimentName && r.types.includes(pipelineTypes.STORED));
            if (pipelines.length >= amount) {
                if (rejectOnFailure) {
                    throw new InvalidDataError(`maximum number [${amount}] of concurrent pipelines has been reached`);
                }
                return true;
            }
        }
        return false;
    }

    validateStopPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.stopRequest, pipeline, true);
    }
}

module.exports = ApiValidator;
