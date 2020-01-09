
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

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
        return stateManager.setExperiment(options);
    }

    async experimentsList(options) {
        return stateManager.experimentsList(options);
    }

    async deleteExperiment(options) {
        const experiment = await stateManager.deleteExperiment(options);
        if (!experiment) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return experiment;
    }
}

module.exports = new Experiment();
