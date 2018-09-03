const uuidv4 = require('uuid/v4');
const randString = require('crypto-random-string');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const execution = require('./execution');

class InternalService {
    async runStoredCron(options) {
        validator.validateStoredInternal(options);
        const jobId = this._createCronJobID(options, uuidv4());
        return execution._runStored(options, jobId);
    }

    async runStoredPipeline(options) {
        validator.validateStoredInternal(options);
        const jobId = this._createPipelineJobID(options);
        if (options.parentJobId) {
            const results = await stateManager.getJobResult({ jobId: options.parentJobId });
            if (results && results.data) {
                options.flowInput = results.data.map(r => r.result);
            }
        }
        const { parentJobId, ...option } = options;
        return execution._runStored(option, jobId);
    }

    async runStoredSubPipeline(options) {
        validator.validateStoredSubPipeline(options);
        const jobID = this._createSubPipelineJobID(options);
        const { jobId, taskId, ...option } = options;
        return execution._runStored(option, jobID);
    }

    async runRawSubPipeline(options) {
        validator.validateRawSubPipeline(options);
        options.name = `raw-${options.name}-${randString(10)}`;
        const jobID = this._createSubPipelineJobID(options);
        const { jobId, taskId, ...option } = options;
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
