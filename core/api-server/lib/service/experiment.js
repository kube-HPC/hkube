
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

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
        return stateManager.experiments.set(options);
    }

    async experimentsList(options) {
        return stateManager.experiments.list(options);
    }

    async deleteExperiment(options) {
        const res = await stateManager.experiments.delete(options);
        const msg = res.deleted === '0' ? 'deleted operation has failed' : 'deleted successfully ';
        return msg;
    }
}

module.exports = new Experiment();
