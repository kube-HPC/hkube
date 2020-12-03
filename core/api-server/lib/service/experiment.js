const objectPath = require('object-path');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const executionService = require('./execution');
const cronService = require('./cron');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const db = require('../db');
const defaultExperiment = require('../consts/defaultExperiment');

class Experiment {
    async getExperiment(options) {
        const { name } = options;
        const experiment = await db.experiments.fetch(options);
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
        await db.experiments.create(experiment);
    }

    experimentsList(options) {
        const { sort, limit } = options;
        return db.experiments.fetchAll({
            query: {},
            sort: { created: sort },
            limit
        });
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
        const res = await db.experiments.delete(options);
        const message = res.deleted === 0 ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name };
    }

    async _stopAllCrons(experimentName) {
        const limit = 1000;
        const pipelines = await stateManager.pipelines.list({ limit }, (p) => this._hasCron(p, experimentName));
        await Promise.all(pipelines.map(p => cronService.updateCronJob(p, { enabled: false })));
    }

    _hasCron(pipeline, experimentName) {
        const enabled = objectPath.get(pipeline, 'triggers.cron.enabled');
        return pipeline.experimentName === experimentName && enabled;
    }

    async _cleanAll(experimentName) {
        const jobId = `${experimentName}:`;
        const pipelines = await stateManager.executions.stored.list({ jobId });
        await Promise.all(pipelines.map(p => executionService.cleanJob({ jobId: p.jobId })));
    }
}

module.exports = new Experiment();
