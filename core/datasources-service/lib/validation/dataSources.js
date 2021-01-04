const dbConnect = require('../db');
const { ResourceNotFoundError } = require('../errors');
/** @typedef {import('express')} Express */

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    /** @param {{ name: string; files: Express.Multer.File[] }} props */
    create(props) {
        const files =
            props.files?.length > 0
                ? props.files.map(file => file.originalname)
                : undefined;
        this._validator.validate(this._validator.definitions.createRequest, {
            ...props,
            files,
        });
    }

    /**
     * @param {{
     *     name: string;
     *     versionDescription: string;
     *     files: {
     *         mapping: FileMeta[];
     *         added: MulterFile[];
     *         dropped: string[];
     *     };
     * }} props
     */
    update(props) {
        const filesAdded =
            props.files.added?.length > 0
                ? props.files.added.map(file => file.originalname)
                : undefined;
        this._validator.validate(this._validator.definitions.update, {
            ...props,
            files: { added: filesAdded },
        });
    }

    delete(props) {
        this._validator.validate(this._validator.definitions.deleteRequest, props);
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
            throw new ResourceNotFoundError(
                'dataSource',
                intersections.join(', ')
            );
        }
    }

    async validateSnapshot(snapshot) {
        this._validator.validate(
            this._validator.definitions.Snapshot,
            snapshot
        );
    }
}

module.exports = DataSources;
