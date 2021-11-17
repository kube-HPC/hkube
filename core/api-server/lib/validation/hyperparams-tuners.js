class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateHyperparamsTuner(hyperparamsTuner, spec) {
        this._validator.validate(this._validator.definitions.hyperparamsTunerSpec, spec, true);
        this._validator.validate(this._validator.definitions.hyperparamsTuner, hyperparamsTuner, true);
    }
}

module.exports = ApiValidator;
