const objectPath = require('object-path');
const validator = require('../validation/api-validator');
const executionService = require('./execution');
const cronService = require('./cron');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const stateManager = require('../state/state-manager');
const defaultExperiment = require('../consts/defaultExperiment');

class Experiment {
    async getExperiment(options) {
        const { name } = options;
        const experiment = await stateManager.getExperiment(options);
        if (!experiment) {
            throw new ResourceNotFoundError('experiment', name);
        }
        return experiment;
    }

    async insertExperiment(options) {
        validator.experiments.validateExperimentName(options);
        const experiment = {
            name: options.name,
            description: options.description,
            created: Date.now(),
        };
        await stateManager.createExperiment(experiment);
    }

    async experimentsList(options) {
        const { sort, limit } = options;
        return stateManager.getExperiments({ sort, limit });
    }

    async deleteExperiment(options) {
        const { name: experimentName } = options;
        if (defaultExperiment.DEFAULT_EXPERIMENT_NAME === experimentName) {
            throw new ActionNotAllowed(defaultExperiment.DEFAULT_EXPERIMENT_ERROR, experimentName);
        }
        await validator.experiments.validateExperimentExists({ experimentName });
        await this._stopAllCrons(experimentName);
        await this._cleanAll(experimentName);
        return this._deleteExperiment(options);
    }

    async _deleteExperiment(options) {
        const { name } = options;
        const res = await stateManager.deleteExperiment({ name });
        const message = res.deleted === 0 ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name };
    }

    async _stopAllCrons(experimentName) {
        const pipelines = await stateManager.searchPipelines({
            experimentName,
            hasCronEnabled: true,
        });
        await Promise.all(pipelines.map(p => cronService.updateCronJob(p, { enabled: false })));
    }

    _hasCron(pipeline, experimentName) {
        const enabled = objectPath.get(pipeline, 'triggers.cron.enabled');
        return pipeline.experimentName === experimentName && enabled;
    }

    async _cleanAll(experimentName) {
        const pipelines = await stateManager.searchJobs({ experimentName, fields: { jobId: true } });
        await Promise.all(pipelines.map(p => executionService.cleanJob({ jobId: p.jobId })));
    }
}

module.exports = new Experiment();
