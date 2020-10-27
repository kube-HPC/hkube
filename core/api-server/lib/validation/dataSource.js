class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    /** @param {{ name: string; file: Express.Multer.File; }} props */
    validateCreate(props) {
        this._validator.validate(this._validator.definitions.dataSourceCreate, props);
    }

    /** @param {{ file: Express.Multer.File; }} props */
    validateUploadFile(props) {
        this._validator.validate(this._validator.definitions.dataSourceUploadFile, props);
    }
}

module.exports = ApiValidator;
