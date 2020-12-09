const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateExperimentName(experiment) {
        this._validator.validate(this._validator.definitions.experiment, experiment, true);
    }

    async validateExperimentExists(pipeline) {
        const { experimentName } = pipeline;
        const result = await stateManager.getExperiment({ name: experimentName });
        if (!result) {
            throw new ResourceNotFoundError('experiment', experimentName);
        }
    }
}

module.exports = ApiValidator;
