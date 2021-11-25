const { InvalidDataError } = require('../errors');
class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateHyperparamsTuner(hyperparamsTuner, spec) {
        if (spec === undefined) {
            throw new InvalidDataError('Hyper params tuner node must have spec attribute');
        }
        if (spec.hyperParams === undefined && spec.sampler?.name !== 'Grid') {
            throw new InvalidDataError('spec must include hyperParams');
        }
        this._validator.validate(this._validator.definitions.hyperparamsTunerSpec, spec, true);
        this._validator.validate(this._validator.definitions.hyperparamsTuner, hyperparamsTuner, true);
    }
}

module.exports = ApiValidator;
