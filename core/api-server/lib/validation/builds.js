class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateBuildId(build) {
        this._validator.validate(this._validator.definitionsInternal.buildId, build, false);
    }

    validateAlgorithmBuild(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmBuild, algorithm);
    }

    validateAlgorithmBuildFromGit(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmBuildGit, algorithm);
    }
}

module.exports = ApiValidator;
