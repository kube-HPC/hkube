const dbConnect = require('../db');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
/**
 * @typedef {import('express')} Express
 * @typedef {import('@hkube/db/lib/DataSource').ExternalStorage} ExternalStorage;
 * @typedef {import('@hkube/db/lib/DataSource').ExternalGit} ExternalGit;
 * @typedef {import('../utils/types').FileMeta} FileMeta
 * @typedef {Express.Multer.File[]} MulterFile
 */

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    /**
     * @param {{
     *     name: string;
     *     files: Express.Multer.File[];
     *     git: ExternalGit;
     *     storage: ExternalStorage;
     * }} props
     */
    create(props) {
        const files = Array.isArray(props.files)
            ? props.files.map(file => file.originalname)
            : [];

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
     *         added: Express.Multer.File[];
     *         dropped: string[];
     *     };
     * }} props
     */
    update(props) {
        const filesAdded =
            props.files.added?.length > 0
                ? props.files.added.map(file => file.originalname)
                : undefined;
        if (!filesAdded && !props.files.dropped && !props.files.mapping) {
            throw new InvalidDataError(
                'you must provide at least one of (files | droppedFileIds | mapping)'
            );
        }
        this._validator.validate(this._validator.definitions.update, {
            ...props,
            files: { added: filesAdded },
        });
    }

    delete(props) {
        this._validator.validate(
            this._validator.definitions.deleteRequest,
            props
        );
    }

    sync(props) {
        this._validator.validate(
            this._validator.definitions.syncRequest,
            props
        );
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

    validateSnapshot(snapshot) {
        this._validator.validate(
            this._validator.definitions.Snapshot,
            snapshot
        );
    }
}

module.exports = DataSources;
