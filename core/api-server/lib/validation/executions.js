const regex = require('../consts/regex');
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

    async validateConcurrentPipelines(pipelines, jobId) {
        if (pipelines.options && pipelines.options.concurrentPipelines) {
            const { amount, rejectOnFailure } = pipelines.options.concurrentPipelines;
            const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
            if (jobIdPrefix) {
                const result = await stateManager.executions.running.list({ jobId: jobIdPrefix[0] });
                if (result.length >= amount) {
                    if (rejectOnFailure) {
                        throw new InvalidDataError(`maximum number [${amount}] of concurrent pipelines has been reached`);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    validateStopPipeline(pipeline) {
        this._validator.validate(this._validator.definitions.stopRequest, pipeline, true);
    }
}

module.exports = ApiValidator;
