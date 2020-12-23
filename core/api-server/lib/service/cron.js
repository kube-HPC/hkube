const objectPath = require('object-path');
const { pipelineTypes } = require('@hkube/consts');
const execution = require('./execution');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class CronService {
    async getCronResult(options) {
        validator.lists.validateResultList(options);
        const { experimentName, name, sort, limit } = options;
        const list = await stateManager.searchJobs({
            experimentName,
            pipelineName: name,
            pipelineType: pipelineTypes.CRON,
            fields: { jobId: true, result: true },
            sort: { 'pipeline.startTime': sort },
            limit
        });
        const map = list.map(l => ({ jobId: l.jobId, ...l.result }));
        const response = await stateManager.mergeJobStorageResults(map);
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron results', options.name);
        }
        return response;
    }

    async getCronStatus(options) {
        validator.lists.validateResultList(options);
        const { experimentName, name, sort, limit } = options;
        const list = await stateManager.searchJobs({
            experimentName,
            pipelineName: name,
            pipelineType: pipelineTypes.CRON,
            sort: { 'pipeline.startTime': sort },
            fields: { jobId: true, status: true },
            limit
        });
        const map = list.map(l => ({ jobId: l.jobId, ...l.status }));
        if (map.length === 0) {
            throw new ResourceNotFoundError('cron status', options.name);
        }
        return map;
    }

    async getCronList(options) {
        const { sort, limit } = options;
        let pipelines = await stateManager.searchPipelines({
            hasCronTriggers: true,
            sort: { startTime: sort },
            fields: { name: true, 'triggers.cron': true },
            limit
        });
        pipelines = pipelines.map(p => ({ name: p.name, cron: p.triggers.cron }));
        return pipelines;
    }

    async runStoredCron(options) {
        validator.internal.validateStoredInternal(options);
        const pipeline = await this._createPipeline(options);
        return execution._runStored({ pipeline, types: [pipelineTypes.STORED, pipelineTypes.INTERNAL, pipelineTypes.CRON] });
    }

    async startCronJob(options) {
        return this._toggleCronJob(options, true);
    }

    async stopCronJob(options) {
        return this._toggleCronJob(options, false);
    }

    async _toggleCronJob(options, enabled) {
        validator.cron.validateCronRequest(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return this.updateCronJob(pipeline, { pattern: options.pattern, enabled });
    }

    async updateCronJob(pipeline, { pattern, enabled }) {
        const cronPattern = objectPath.get(pipeline, 'triggers.cron.pattern');
        objectPath.set(pipeline, 'triggers.cron.enabled', enabled);
        objectPath.set(pipeline, 'triggers.cron.pattern', pattern || cronPattern || '0 * * * *');
        await stateManager.updatePipeline(pipeline);
        return pipeline;
    }

    async _createPipeline(options) {
        const { name } = options;
        const experimentName = await this._getExperimentName({ name });
        return { ...options, experimentName };
    }

    async _getExperimentName(options) {
        const { name } = options;
        const pipeline = await stateManager.getPipeline({ name });
        const experiment = { name: (pipeline && pipeline.experimentName) || undefined };
        validator.experiments.validateExperimentName(experiment);
        return experiment.name;
    }
}

module.exports = new CronService();
