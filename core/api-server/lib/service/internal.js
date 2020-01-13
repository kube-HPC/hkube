const { pipelineTypes } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');
const { uuid } = require('../utils');

class InternalService {
    async runStoredPipeline(options) {
        let pipeline = options;
        validator.validateStoredInternal(pipeline);
        const jobId = this._createPipelineJobID(pipeline);
        if (pipeline.parentJobId) {
            const results = await stateManager.getJobResult({ jobId: pipeline.parentJobId });
            if (results && results.data) {
                pipeline = {
                    ...pipeline,
                    flowInput: results // flowInput must be object
                };
            }
        }
        const { parentJobId, ...option } = pipeline;
        return execution._runStored({ pipeline: option, jobId, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED] });
    }

    async runStoredSubPipeline(options) {
        validator.validateStoredSubPipeline(options);
        const jobID = this._createSubPipelineJobID(options);
        const { jobId, taskId, rootJobId, ...pipeline } = options;
        pipeline.rootJobId = rootJobId || jobId;
        return execution._runStored({ pipeline, jobId: jobID, types: [pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE] });
    }

    async runRawSubPipeline(options) {
        validator.validateRawSubPipeline(options);
        const jobID = this._createSubPipelineJobID(options);
        const { jobId, taskId, ...pipeline } = options;
        const parentSpan = options.spanId;
        return execution._run({ pipeline, jobId: jobID, options: { parentSpan }, types: [pipelineTypes.INTERNAL, pipelineTypes.RAW, pipelineTypes.SUB_PIPELINE] });
    }

    _createCronJobID(options, uid) {
        return ['cron', options.name, uid].join(':');
    }

    _createPipelineJobID(options) {
        return [options.parentJobId, options.name].join('.');
    }

    _createSubPipelineJobID(options) {
        return ['sub', options.name, uuid()].join(':');
    }
}

module.exports = new InternalService();
