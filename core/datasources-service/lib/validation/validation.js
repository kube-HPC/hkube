const { InvalidDataError } = require('../errors');

class Snapshots {
    constructor(validator) {
        this._validator = validator;
    }

    dataSourceExists({ name, versionId, snapshot }) {
        this._validator.validate(this._validator.definitions.dataSourceExists, {
            name,
            versionId,
            snapshot,
        });
        if (versionId && snapshot.name) {
            throw new InvalidDataError(
                'you must provide *only* one of (version_id | snapshot_name)'
            );
        }
        if (versionId && name) {
            throw new InvalidDataError(
                'you must not provide both datasource_name and version_id'
            );
        }
        if (snapshot.name && !name) {
            throw new InvalidDataError(
                'you must provide datasource_name when validating by snapshot_name'
            );
        }
    }
}

module.exports = Snapshots;
