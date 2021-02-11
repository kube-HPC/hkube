const validationMessages = require('../consts/validationMessages');
const regex = require('../consts/regex');

const formatMessages = new Map();

class ApiValidator {
    init(definitions, ...validators) {
        validators.forEach(v => this._init(v, definitions));
        this._addFormatMessages();
    }

    _init(validatorInstance, definitions) {
        // eslint-disable-next-line no-param-reassign
        validatorInstance.errorsText = this.wrapErrorMessageFn(
            validatorInstance.errorsText.bind(validatorInstance)
        ).bind(this); // eslint-disable-line
        validatorInstance.addFormat(
            'dataSource-name',
            this._validateDataSourceName
        );
        validatorInstance.addFormat('url', this._validateURL);
        validatorInstance.addFormat('download-id', this._validateDownloadId);

        validatorInstance.addFormat('binary', this._validateBinary);

        Object.entries(definitions).forEach(([k, v]) => {
            validatorInstance.addSchema(v, `#/components/schemas/${k}`);
        });
    }

    _addFormatMessages() {
        formatMessages.set('binary', validationMessages.BINARY_FILE_NAME);
        formatMessages.set(
            'dataSource-name',
            validationMessages.DATASOURCE_NAME_FORMAT
        );
        formatMessages.set(
            'download-id',
            validationMessages.DOWNLOAD_ID_FORMAT
        );
        formatMessages.set('url', validationMessages.URL_FORMAT);
    }

    _validateBinary(file) {
        return file !== undefined;
    }

    _validateDataSourceName(name) {
        return regex.DATASOURCE_NAME_REGEX.test(name);
    }

    _validateURL(url) {
        try {
            // eslint-disable-next-line
            new URL(url);
        } catch (e) {
            return false;
        }
        return true;
    }

    _validateDownloadId(downloadId) {
        return regex.DOWNLOAD_ID_REGEX.test(downloadId);
    }

    wrapErrorMessageFn(wrappedFn) {
        const errorsTextWrapper = (errors, options) => {
            let message;
            if (errors) {
                message = this.getCustomMessage(errors[0]);
            }
            return message || wrappedFn(errors, options);
        };
        return errorsTextWrapper;
    }

    getCustomMessage(e) {
        if (e.keyword === 'format') {
            return formatMessages.get(e.params.format);
        }
        return undefined;
    }
}

module.exports = new ApiValidator();
