const { InvalidDataError } = require('../errors');

class Snapshots {
    constructor(validator) {
        this._validator = validator;
    }

    dataSourceExists({ dataSourceName, versionId, snapshotName }) {
        this._validator.validate(this._validator.definitions.dataSourceExists, {
            name: dataSourceName,
            versionId,
            snapshotName,
        });
        if (versionId && snapshotName) {
            throw new InvalidDataError(
                'you must provide *only* one of (version_id | snapshot_name)'
            );
        }
        if (versionId && dataSourceName) {
            throw new InvalidDataError(
                'you must not provide both datasource_name and version_id'
            );
        }
        if (snapshotName && !dataSourceName) {
            throw new InvalidDataError(
                'you must provide datasource_name when validating by snapshot_name'
            );
        }
    }
}

module.exports = Snapshots;
