const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

class InternalService {
    async runStoredTriggerPipeline(options) {
        validator.internal.validateStoredInternal(options);
        const { name, parentJobId } = options;
        const execPipeline = await stateManager.executions.stored.get({ jobId: parentJobId });
        const experimentName = await this._getExperiment(execPipeline);
        const rootJobId = execPipeline.rootJobId || parentJobId;
        const rootJobName = execPipeline.name;
        const jobId = execution._createJobID({ experimentName, name });
        const pipeline = { name };

        const results = await stateManager.getJobResult({ jobId: parentJobId });
        if (results && results.data) {
            pipeline.flowInput = { parent: results.data };
        }
        await stateManager.triggers.tree.set({ name, rootJobName, jobId, rootJobId, parentJobId });
        return execution._runStored({ pipeline, jobId, rootJobId, mergeFlowInput: true, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.TRIGGER] });
    }

    async runStoredSubPipeline(options) {
        validator.internal.validateStoredSubPipeline(options);
        const { pipeline, rootJobId, parentSpan } = await this._createPipeline(options);
        return execution._runStored({ pipeline, rootJobId, mergeFlowInput: true, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE] });
    }

    async runRawSubPipeline(options) {
        validator.internal.validateRawSubPipeline(options);
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
        return this._getExperiment(pipeline);
    }

    _getExperiment(pipeline) {
        const experiment = { name: (pipeline && pipeline.experimentName) || undefined };
        validator.experiments.validateExperimentName(experiment);
        return experiment.name;
    }
}

module.exports = new InternalService();
