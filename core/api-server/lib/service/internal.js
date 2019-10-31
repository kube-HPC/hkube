const uuidv4 = require('uuid/v4');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

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
        return execution._runStored(option, jobId);
    }

    async runStoredSubPipeline(options) {
        validator.validateStoredSubPipeline(options);
        
        const jobID = this._createSubPipelineJobID(options);
        const { jobId, taskId,rootJobId, ...option } = options;
       
        option.rootJobId = rootJobId || jobId;
        return execution._runStored(option, jobID);
    }

    async runRawSubPipeline(options) {
        validator.validateRawSubPipeline(options);
        const pipeline = {
            ...options,
            name: execution.createRawName(options)
        };
        const jobID = this._createSubPipelineJobID(pipeline);
        const { jobId, taskId, ...option } = pipeline;
        return execution._run(option, jobID);
    }

    _createCronJobID(options, uuid) {
        return ['cron', options.name, uuid].join(':');
    }

    _createPipelineJobID(options) {
        return [options.parentJobId, options.name].join('.');
    }

    _createSubPipelineJobID(options) {
        return ['sub', options.jobId, options.taskId, uuidv4()].join('.');
    }

    _createJobID(options) {
        return [`${options.name}:${uuidv4()}`, options.name].join('.');
    }
}

module.exports = new InternalService();
