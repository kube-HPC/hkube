class Snapshots {
    constructor(validator) {
        this._validator = validator;
    }

    async validateSnapshot(snapshot) {
        this._validator.validate(
            this._validator.definitions.SnapshotCreate,
            snapshot
        );
    }
}

module.exports = Snapshots;
