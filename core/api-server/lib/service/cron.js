const objectPath = require('object-path');
const { uid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const { pipelineTypes } = require('@hkube/consts');
const execution = require('./execution');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError } = require('../errors');

class ExecutionService {
    async getCronResult(options) {
        validator.lists.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.getJobResults({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron results', options.name);
        }
        return response;
    }

    async getCronStatus(options) {
        validator.lists.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.jobs.status.list({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron status', options.name);
        }
        return response;
    }

    async getCronList(options) {
        let pipelines = await stateManager.pipelines.list(options, l => l.triggers && l.triggers.cron);
        pipelines = pipelines.map(p => ({ name: p.name, cron: p.triggers.cron }));
        return pipelines;
    }

    async runStoredCron(options) {
        validator.internal.validateStoredInternal(options);
        const pipeline = await this._createPipeline(options);
        const jobId = this._createCronJobID(pipeline, uid({ length: 8 }));
        return execution._runStored({ pipeline, jobId, types: [pipelineTypes.STORED, pipelineTypes.INTERNAL, pipelineTypes.CRON] });
    }

    async startCronJob(options) {
        return this._toggleCronJob(options, true);
    }

    async stopCronJob(options) {
        return this._toggleCronJob(options, false);
    }

    async _toggleCronJob(options, enabled) {
        validator.cron.validateCronRequest(options);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return this.updateCronJob(pipeline, { pattern: options.pattern, enabled });
    }

    async updateCronJob(pipeline, { pattern, enabled }) {
        const cronPattern = objectPath.get(pipeline, 'triggers.cron.pattern');
        objectPath.set(pipeline, 'triggers.cron.enabled', enabled);
        objectPath.set(pipeline, 'triggers.cron.pattern', pattern || cronPattern || '0 * * * *');
        await storageManager.hkubeStore.put({ type: 'pipeline', name: pipeline.name, data: pipeline });
        await stateManager.pipelines.set(pipeline);
        return pipeline;
    }

    async _createPipeline(options) {
        const { name } = options;
        const experimentName = await this._getExperimentName({ name });
        return { ...options, experimentName };
    }

    async _getExperimentName(options) {
        const { name } = options;
        const pipeline = await stateManager.pipelines.get({ name });
        const experiment = { name: (pipeline && pipeline.experimentName) || undefined };
        validator.experiments.validateExperimentName(experiment);
        return experiment.name;
    }

    _createCronJobID(options, id) {
        return [options.experimentName, pipelineTypes.CRON, options.name, id].join(':');
    }
}

module.exports = new ExecutionService();
