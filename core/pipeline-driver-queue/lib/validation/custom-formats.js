const validationMessages = require('../consts/validationMessages');
const regex = require('../consts/regex');
const formatMessages = new Map();

class ApiValidator {
    init(definitions, ...validators) {
        validators.forEach(v => this._init(v, definitions));
        this._addFormatMessages();
    }

    _init(validatorInstance, definitions) {
        validatorInstance.errorsText = this.wrapErrorMessageFn(validatorInstance.errorsText.bind(validatorInstance)).bind(this);// eslint-disable-line
        validatorInstance.addFormat('pipeline-name', this._validatePipelineName);
        Object.entries(definitions).forEach(([k, v]) => {
            validatorInstance.addSchema(v, `#/components/schemas/${k}`);
        });
    }

    _addFormatMessages() {
        formatMessages.set('pipeline-name', validationMessages.PIPELINE_NAME_FORMAT);
    }

    _validatePipelineName(name) {
        return regex.PIPELINE_NAME_REGEX.test(name);
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
}

module.exports = new ApiValidator();
