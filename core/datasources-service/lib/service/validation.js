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

    /**
     * @param {{
     *     name?: string;
     *     id?: string;
     *     snapshot?: { name: string };
     * }} props
     */
    async dataSourceExists({ name, snapshot, id }) {
        validator.validation.dataSourceExists({
            name,
            snapshot,
            id,
        });
        if (id) {
            return this.db.dataSources.fetch(
                { id },
                { allowNotFound: false, fields: { _id: 1 } }
            );
        }
        if (snapshot.name)
            return this.db.snapshots.fetch(
                { name: snapshot.name, 'dataSource.name': name },
                { allowNotFound: false, fields: { _id: 1 } }
            );
        return this.db.dataSources.fetch(
            { name },
            { allowNotFound: false, fields: { _id: 1 } }
        );
    }
}

module.exports = new Validation();
