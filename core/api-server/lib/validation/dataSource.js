const dbConnect = require('../db');
const { ResourceNotFoundError } = require('../errors');
/** @typedef {import('express')} Express */

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    /** @param {{ name: string; file: Express.Multer.File}} props */
    validateCreate(props) {
        this._validator.validate(this._validator.definitions.dataSourceCreate, { ...props, file: props.file?.originalname });
    }

    /** @param {{ file: Express.Multer.File; }} props */
    validateUploadFile(props) {
        this._validator.validate(this._validator.definitions.dataSourceUploadFile, { ...props, file: props.file?.originalname });
    }

    /** @param {string[]} dataSources */
    async validateDataSourceExists(dataSources) {
        const db = dbConnect.connection;
        if (dataSources.length === 0) {
            return;
        }
        const entries = await db.dataSources.fetchMany({ names: dataSources });
        const namesSet = new Set(entries.map(entry => entry.name));
        const intersections = dataSources.filter(entry => !namesSet.has(entry));
        if (intersections.length > 0) {
            throw new ResourceNotFoundError('dataSource', intersections.join(', '));
        }
    }
}

module.exports = ApiValidator;
