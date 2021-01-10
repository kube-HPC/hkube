const validator = require('../validation');
const dbConnection = require('../db');

/**
 * @typedef {import('../utils/types').config} config
 * @typedef {import('@hkube/db/lib/Snapshots').Snapshot} SnapshotItem;
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 */

class Validation {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
    }

    async dataSourceExists({ dataSourceName, snapshotName, versionId }) {
        validator.validation.dataSourceExists({
            dataSourceName,
            snapshotName,
            versionId,
        });
        if (versionId) {
            const dataSourceEntry = await this.db.dataSources.fetch(
                { id: versionId },
                { allowNotFound: false, fields: { _id: 1 } }
            );
            return dataSourceEntry;
        }
        if (snapshotName)
            return this.db.snapshots.fetch(
                { name: snapshotName, 'dataSource.name': dataSourceName },
                { allowNotFound: false, fields: { _id: 1 } }
            );
        return this.db.dataSources.fetch(
            { name: dataSourceName },
            { allowNotFound: false, fields: { _id: 1 } }
        );
    }
}

module.exports = new Validation();
