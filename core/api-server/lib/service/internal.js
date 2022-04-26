const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

class InternalService {
    async runStoredTriggerPipeline(options) {
        validator.internal.validateStoredInternal(options);
        const { name, parentJobId } = options;
        const execPipeline = await stateManager.getJobPipeline({ jobId: parentJobId });
        const rootJobId = execPipeline.rootJobId || parentJobId;
        const rootJobName = execPipeline.name;
        const pipeline = { name };

        const results = await stateManager.getJobResult({ jobId: parentJobId });
        if (results?.data) {
            pipeline.flowInput = { parent: results.data };
        }
        const { jobId, gateways } = await execution._runStored({ pipeline, rootJobId, mergeFlowInput: true, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.TRIGGER] });
        await stateManager.updateTriggersTree({ name, rootJobName, jobId, rootJobId, parentJobId });
        return { jobId, gateways };
    }

    async runStoredSubPipeline(options) {
        validator.internal.validateStoredSubPipeline(options);
        const { pipeline, rootJobId, parentSpan } = await this._createPipeline(options);
        return execution._runStored({ pipeline, rootJobId, mergeFlowInput: true, parentSpan, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE] });
    }

    async runRawSubPipeline(options) {
        validator.internal.validateRawSubPipeline(options);
        const { pipeline, rootJobId, spanId: parentSpan } = await this._createPipeline(options);
        return execution._runPipeline({ pipeline, rootJobId, parentSpan, types: [pipelineTypes.INTERNAL, pipelineTypes.RAW, pipelineTypes.SUB_PIPELINE] });
    }

    async _createPipeline(options) {
        const { jobId, taskId, parentJobId, rootJobId, spanId, ...pipeline } = options;
        const experimentName = await this._getExperimentName({ jobId: jobId || parentJobId });
        pipeline.experimentName = experimentName;
        return { pipeline, rootJobId: rootJobId || jobId, parentSpan: spanId };
    }

    async _getExperimentName(options) {
        const { jobId } = options;
        const pipeline = await stateManager.getJobPipeline({ jobId });
        return this._getExperiment(pipeline);
    }

    _getExperiment(pipeline) {
        const experiment = { name: (pipeline && pipeline.experimentName) || undefined };
        validator.experiments.validateExperimentName(experiment);
        return experiment.name;
    }
}

module.exports = new InternalService();
