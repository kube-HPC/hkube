const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

class InternalService {
    async runStoredTriggerPipeline(options) {
        validator.validateStoredInternal(options);
        let newPipeline = options;
        const jobId = this._createPipelineJobID(newPipeline);
        if (newPipeline.parentJobId) {
            const results = await stateManager.getJobResult({ jobId: newPipeline.parentJobId });
            if (results && results.data) {
                newPipeline = {
                    ...newPipeline,
                    flowInput: { parent: results.data }
                };
            }
        }
        const { pipeline } = await this._createPipeline(newPipeline);
        return execution._runStored({ pipeline, jobId, flowInputNoMerge: true, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.TRIGGER] });
    }

    async runStoredSubPipeline(options) {
        validator.validateStoredSubPipeline(options);
        const { pipeline, rootJobId, parentSpan } = await this._createPipeline(options);
        return execution._runStored({ pipeline, rootJobId, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE] });
    }

    async runRawSubPipeline(options) {
        validator.validateRawSubPipeline(options);
        const { pipeline, rootJobId, parentSpan } = await this._createPipeline(options);
        return execution._run({ pipeline, rootJobId, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.RAW, pipelineTypes.SUB_PIPELINE] });
    }

    async _createPipeline(options) {
        const { jobId, taskId, parentJobId, rootJobId, spanId, ...pipeline } = options;
        const experimentName = await this._getExperimentName({ jobId: jobId || parentJobId });
        pipeline.experimentName = experimentName;
        return { pipeline, rootJobId: rootJobId || jobId, parentSpan: spanId };
    }

    async _getExperimentName(options) {
        const { jobId } = options;
        const pipeline = await stateManager.executions.stored.get({ jobId });
        const experiment = { name: (pipeline && pipeline.experimentName) || undefined };
        validator.validateExperimentName(experiment);
        return experiment.name;
    }

    _createPipelineJobID(options) {
        return [options.parentJobId, options.name].join('.');
    }
}

module.exports = new InternalService();
