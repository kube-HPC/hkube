const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const { ResourceNotFoundError } = require('../errors');
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
        return this.db.snapshots.create(snapshot);
    }

    async fetch({ dataSourceName, snapshotName }) {
        let response = null;
        try {
            response = this.db.snapshots.fetch(
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
}

module.exports = new Snapshots();
