const dbConnect = require('../db');
const { ResourceNotFoundError } = require('../errors');
/** @typedef {import('express')} Express */

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    /** @param {{ name: string; files: Express.Multer.File[]}} props */
    validateCreate(props) {
        const files = props.files?.length > 0 ? props.files.map(file => file.originalname) : undefined;
        this._validator.validate(this._validator.definitions.dataSourceCreate, { ...props, files });
    }

    /** @param {{ filesAdded: Express.Multer.File[]; versionDescription: string, filesDropped: string[] }} props */
    validateUploadFile(props) {
        const filesAdded = props.filesAdded?.length > 0 ? props.filesAdded.map(file => file.originalname) : undefined;
        this._validator.validate(this._validator.definitions.dataSourceUploadFile, { ...props, filesAdded });
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
