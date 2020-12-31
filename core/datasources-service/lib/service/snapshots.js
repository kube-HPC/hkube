const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const { ResourceNotFoundError, ResourceExistsError } = require('../errors');
const validator = require('../validation');
const dbConnection = require('../db');

/**
 * @typedef {import('./../utils/types').config} config
 * @typedef {import('@hkube/db/lib/Snapshots').Snapshot} SnapshotItem;
 */

class Snapshots {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        /** @type {import('@hkube/db/lib/MongoDB').ProviderInterface} */
        this.db = dbConnection.connection;
    }

    async fetchAll({ id }) {
        return this.db.snapshots.fetchAll({ query: { 'dataSource.id': id } });
    }

    async create(snapshot) {
        validator.snapshots.validateSnapshot(snapshot);
        let response = null;
        try {
            response = await this.db.snapshots.create(snapshot);
        } catch (error) {
            if (isDBError(error) && error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('snapshot', snapshot.name, error);
            }
            throw error;
        }
        return response;
    }

    async fetch({ dataSourceName, snapshotName }) {
        let response = null;
        try {
            response = await this.db.snapshots.fetch(
                { name: snapshotName, 'dataSource.name': dataSourceName },
                { allowNotFound: false }
            );
        } catch (error) {
            if (isDBError(error) && error.type === errorTypes.NOT_FOUND) {
                throw new ResourceNotFoundError(
                    'snapshot',
                    snapshotName,
                    error
                );
            }
            throw error;
        }
        return response;
    }

    async fetchDataSource({ dataSourceName, snapshotName }) {
        const response = await this.db.snapshots.fetchDataSource({
            dataSourceName,
            snapshotName,
        });
        if (!response) {
            throw new ResourceNotFoundError('snapshot', snapshotName);
        }
        return response;
    }
}

module.exports = new Snapshots();
