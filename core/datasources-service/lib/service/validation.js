const validator = require('../validation');
const dbConnection = require('../db');

class Validation {
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
    }

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
        if (snapshot.name) {
            return this.db.snapshots.fetch(
                { name: snapshot.name, 'dataSource.name': name },
                { allowNotFound: false, fields: { _id: 1 } }
            );
        }
        return this.db.dataSources.fetch(
            { name },
            { allowNotFound: false, fields: { _id: 1 } }
        );
    }
}

module.exports = new Validation();
