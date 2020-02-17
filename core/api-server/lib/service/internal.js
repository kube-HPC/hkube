const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

class InternalService {
    async runStoredTriggerPipeline(options) {
        let pipeline = options;
        validator.validateStoredInternal(pipeline);
        const jobId = this._createPipelineJobID(pipeline);
        if (pipeline.parentJobId) {
            const results = await stateManager.getJobResult({ jobId: pipeline.parentJobId });
            if (results && results.data) {
                pipeline = {
                    ...pipeline,
                    flowInput: { data: results.data } // flowInput must be object
                };
            }
        }
        const { parentJobId, ...option } = pipeline;
        return execution._runStored({ pipeline: option, jobId, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.TRIGGER] });
    }

    async runStoredSubPipeline(options) {
        validator.validateStoredSubPipeline(options);
        const pipeline = await this._createPipeline(options);
        const parentSpan = options.spanId;
        return execution._runStored({ pipeline, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE] });
    }

    async runRawSubPipeline(options) {
        validator.validateRawSubPipeline(options);
        const pipeline = await this._createPipeline(options);
        const parentSpan = options.spanId;
        return execution._run({ pipeline, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.RAW, pipelineTypes.SUB_PIPELINE] });
    }

    async _createPipeline(options) {
        const { jobId, taskId, rootJobId, ...pipeline } = options;
        const experimentName = await this._getExperimentName({ jobId });
        pipeline.rootJobId = rootJobId || jobId;
        pipeline.experimentName = experimentName;
        return pipeline;
    }

    async _getExperimentName(options) {
        const { jobId } = options;
        const pipeline = await stateManager.executions.stored.get({ jobId });
        return (pipeline && pipeline.experimentName) || undefined;
    }

    _createPipelineJobID(options) {
        return [options.parentJobId, options.name].join('.');
    }
}

module.exports = new InternalService();
