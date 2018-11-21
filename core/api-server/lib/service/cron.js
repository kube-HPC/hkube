const uuidv4 = require('uuid/v4');
const objectPath = require('object-path');
const storageManager = require('@hkube/storage-manager');
const execution = require('../../lib/service/execution');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');

class ExecutionService {
    async getCronResult(options) {
        validator.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.getJobResults({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron results', options.name);
        }
        return response;
    }

    async getCronStatus(options) {
        validator.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.getJobStatuses({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron status', options.name);
        }
        return response;
    }

    async getCronList(options) {
        let pipelines = await stateManager.getPipelines(options, l => l.triggers && l.triggers.cron);
        pipelines = pipelines.map(p => ({ name: p.name, cron: p.triggers.cron }));
        return pipelines;
    }

    async runStoredCron(options) {
        validator.validateStoredInternal(options);
        const jobId = this._createCronJobID(options, uuidv4());
        return execution._runStored(options, jobId);
    }

    async startCronJob(options) {
        return this._toggleCronJob(options, true);
    }

    async stopCronJob(options) {
        return this._toggleCronJob(options, false);
    }

    async _toggleCronJob(options, toggle) {
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        if (!pipeline.triggers || !pipeline.triggers.cron) {
            throw new InvalidDataError(`pipeline ${pipeline.name} does not have any cron trigger`);
        }
        objectPath.set(pipeline, 'triggers.cron.enabled', toggle);
        await storageManager.hkubeStore.put({ type: 'pipeline', name: pipeline.name, data: pipeline });
        await stateManager.setPipeline(pipeline);
        return pipeline;
    }

    _createCronJobID(options, uuid) {
        return ['cron', options.name, uuid].join(':');
    }
}

module.exports = new ExecutionService();
