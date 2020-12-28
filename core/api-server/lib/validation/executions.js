const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateRunRawPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false, { validateNodes: false, checkFlowInput: true, validateStateType: false });
    }

    validateRunStoredPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, false);
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
        if (pipeline.options?.concurrentPipelines) {
            const { experimentName, name: pipelineName } = pipeline;
            const { amount, rejectOnFailure } = pipeline.options.concurrentPipelines;
            const result = await stateManager.searchJobs({ experimentName, pipelineName, hasResult: false, fields: { jobId: true } });
            if (result.length >= amount) {
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
