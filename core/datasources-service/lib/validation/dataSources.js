const { S3 } = require('aws-sdk');
const dbConnect = require('../db');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

/**
 * @typedef {import('express')} Express
 * @typedef {import('@hkube/db/lib/DataSource').StorageConfig} StorageConfig;
 * @typedef {import('@hkube/db/lib/DataSource').GitConfig} GitConfig;
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
     *     git: GitConfig;
     *     storage: StorageConfig;
     * }} props
     */
    async create(props) {
        const files = Array.isArray(props.files)
            ? props.files.map(file => file.originalname)
            : [];
        this._validator.validate(this._validator.definitions.createRequest, {
            ...props,
            files,
        });
        const url = new URL(props.storage.endpoint);
        let port = parseInt(url.port, 10);
        if (Number.isNaN(port)) {
            port = url.protocol === 'https:' ? 443 : 80;
        }
        const s3Client = new S3({
            endpoint: {
                host: url.host,
                href: url.href,
                protocol: url.protocol,
                hostname: url.hostname,
                port,
            },
            s3ForcePathStyle: true,
            s3BucketEndpoint: false,
            credentials: {
                accessKeyId: props.storage.accessKeyId,
                secretAccessKey: props.storage.secretAccessKey,
            },
        });
        try {
            // validate the bucket exists and the permissions are valid
            await s3Client
                .headBucket({
                    Bucket: props.storage.bucketName,
                })
                .promise();
        } catch (error) {
            if (error.code === 'NotFound') {
                throw new InvalidDataError('S3 bucket name does not exist');
            }
            if (error.code === 'Forbidden') {
                throw new InvalidDataError(
                    'Invalid S3 accessKeyId or secretAccessKey'
                );
            }
            if (error.code === 'UnknownEndpoint') {
                throw new InvalidDataError('Invalid S3 endpoint');
            }
            throw error;
        }
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
                'provide at least one of (files | droppedFileIds | mapping)'
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
