class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCreate(props) {
        this._validator.validate(this._validator.definitions.dataSourceCreate, props);
    }

    validateName(name) {
        this._validator.validate(this._validator.definitionsInternal.dataSourceName, name);
    }
}

module.exports = ApiValidator;
