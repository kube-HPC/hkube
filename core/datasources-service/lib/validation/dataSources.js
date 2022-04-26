const https = require('https');
const { S3 } = require('aws-sdk');
const dbConnect = require('../db');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const { Github } = require('../utils/GitRemoteClient');

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    async create(props) {
        const files = Array.isArray(props.files)
            ? props.files.map(file => file.originalname)
            : [];
        this._validator.validate(this._validator.definitions.createRequest, {
            ...props,
            files,
        });
        await this.validateStorage(props.storage);
        await this.validateGit(props.git);
    }

    async validateGit(git) {
        switch (git.kind) {
            case 'internal':
                return null;
            case 'github':
                return Github.validateRepository(git.repositoryUrl, git.token);
            default:
                return null;
        }
    }

    async validateStorage(storage) {
        if (storage.kind === 'internal') return;

        const url = new URL(storage.endpoint);
        let port = parseInt(url.port, 10);
        if (Number.isNaN(port)) {
            port = url.protocol === 'https:' ? 443 : 80;
        }
        let agent;
        if (url.protocol === 'https:' && !storage.verifySsl) {
            agent = new https.Agent({
                rejectUnauthorized: false,
            });
        }
        const s3Client = new S3({
            endpoint: {
                host: url.host,
                href: url.href,
                protocol: url.protocol,
                hostname: url.hostname,
                port,
            },
            httpOptions: {
                agent
            },
            s3ForcePathStyle: true,
            s3BucketEndpoint: false,
            credentials: {
                accessKeyId: storage.accessKeyId,
                secretAccessKey: storage.secretAccessKey,
            },
        });
        try {
            // validate the bucket exists and the permissions are valid
            await s3Client
                .headBucket({
                    Bucket: storage.bucketName,
                })
                .promise();
        }
        catch (error) {
            if (error.code === 'NotFound') {
                throw new InvalidDataError('S3 bucket name does not exist');
            }
            if (error.code === 'Forbidden') {
                throw new InvalidDataError('Invalid S3 accessKeyId or secretAccessKey');
            }
            if (error.code === 'UnknownEndpoint') {
                throw new InvalidDataError('Invalid S3 endpoint');
            }
            throw error;
        }
    }

    update(props) {
        const filesAdded = props.files.added?.length > 0
            ? props.files.added.map(file => file.originalname)
            : undefined;
        if (!filesAdded && !props.files.dropped && !props.files.mapping) {
            throw new InvalidDataError('provide at least one of (files | droppedFileIds | mapping)');
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

    updateCredentials(props) {
        this._validator.validate(
            this._validator.definitions.updateCredentials,
            props
        );
    }

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

    validateSnapshot(snapshot) {
        this._validator.validate(
            this._validator.definitions.Snapshot,
            snapshot
        );
    }
}

module.exports = DataSources;
