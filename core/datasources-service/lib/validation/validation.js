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
    }
}

module.exports = Snapshots;
