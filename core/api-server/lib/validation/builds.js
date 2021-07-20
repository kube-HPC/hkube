class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateBuildId(build) {
        this._validator.validate(this._validator.definitions.buildIdObject, build, false);
    }

    validateAlgorithmBuild(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmBuild, algorithm);
    }
}

module.exports = ApiValidator;
