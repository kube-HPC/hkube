class Snapshots {
    constructor(validator) {
        this._validator = validator;
    }

    validateSnapshot(snapshot) {
        this._validator.validate(
            this._validator.definitions.SnapshotCreate,
            snapshot
        );
    }

    validatePreview({ id, query }) {
        this._validator.validate(
            this._validator.definitions.SnapshotPreviewRequest,
            { id, query }
        );
    }
}

module.exports = Snapshots;
