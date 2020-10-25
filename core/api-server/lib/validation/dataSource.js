class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCreate(props) {
        this._validator.validate(this._validator.definitions.dataSourceCreate, props);
    }
}

module.exports = ApiValidator;
