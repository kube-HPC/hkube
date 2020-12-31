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
        return this.db.snapshots.fetch(
            { name: snapshotName, 'dataSource.name': dataSourceName },
            { allowNotFound: false }
        );
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
