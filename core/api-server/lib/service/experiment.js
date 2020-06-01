const { pipelineStatuses } = require('@hkube/consts');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const cronService = require('./cron');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const defaultExperiment = require('../consts/defaultExperiment');
const limit = 1000;

class Experiment {
    async getExperiment(options) {
        const { name } = options;
        const experiment = await stateManager.experiments.get(options);
        if (!experiment) {
            throw new ResourceNotFoundError('experiment', name);
        }
        return experiment;
    }

    async insertExperiment(options) {
        await stateManager.experiments.set(options);
        await storageManager.hkubeStore.put({ type: 'experiment', name: options.name, data: options });
    }

    experimentsList(options) {
        return stateManager.experiments.list(options);
    }

    async deleteExperiment(options) {
        const { name: experimentName } = options;
        if (defaultExperiment.DEFAULT_EXPERIMENT_NAME === experimentName) {
            throw new ActionNotAllowed(defaultExperiment.DEFAULT_EXPERIMENT_ERROR, experimentName);
        }
        await validator.validateExperimentExists({ experimentName });
        await this._stopAllCrons(experimentName);
        await this._stopAllRunningJobs(experimentName);
        await this._deleteAllRelations(experimentName);

        const res = await stateManager.experiments.delete(options);
        await storageManager.hkubeStore.delete({ type: 'experiment', name: options.name });
        const message = res.deleted === '0' ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name: options.name };
    }

    async _stopAllCrons(experimentName) {
        const pipelines = await stateManager.pipelines.list({ limit }, p => p.experimentName === experimentName);
        await Promise.all(pipelines.map(p => cronService.updateCronJob(p, { enabled: false })));
    }

    async _deleteAllRelations(experimentName) {
        const jobId = `${experimentName}:`;
        const pipelines = await stateManager.executions.stored.list({ jobId });
        await Promise.all(pipelines.map(p => this._deleteJob(p.jobId)));
    }

    async _deleteJob(jobId) {
        await stateManager.jobs.results.delete({ jobId });
        await stateManager.jobs.status.delete({ jobId });
        await stateManager.executions.stored.delete({ jobId });
        await storageManager.hkubeExecutions.delete({ jobId });
    }

    async _stopAllRunningJobs(experimentName) {
        const jobId = `${experimentName}:`;
        const status = pipelineStatuses.STOPPED;
        const reason = 'experiment has been deleted';
        const pipelines = await stateManager.executions.running.list({ jobId });
        await Promise.all(pipelines.map(p => this._stopAllRunningJob({ pipeline: p, jobId: p.jobId, status, reason })));
    }

    async _stopAllRunningJob({ pipeline, jobId, status, reason }) {
        await stateManager.jobs.status.update({ jobId, status, reason, level: levels.INFO.name });
        await stateManager.jobs.results.set({ jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason, status });
    }
}

module.exports = new Experiment();
