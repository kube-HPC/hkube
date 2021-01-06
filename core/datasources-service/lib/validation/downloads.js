class Downloads {
    constructor(validator) {
        this._validator = validator;
    }

    async validatePrepareForDownload({ dataSourceId, fileIds }) {
        this._validator.validate(
            this._validator.definitions.PrepareForDownloadRequest,
            { dataSourceId, fileIds }
        );
    }

    async validateDownloadId(downloadId) {
        this._validator.validate(
            this._validator.definitions.DownloadId,
            downloadId
        );
    }
}

module.exports = Downloads;
