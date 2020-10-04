const converter = require('@hkube/units-converter');
const { CronJob } = require('cron');
const validationMessages = require('../consts/validationMessages');
const regex = require('../consts/regex');
const { InvalidDataError } = require('../errors');
const MIN_MEMORY = 4;
const formatMessages = new Map();

class ApiValidator {
    init(definitions, ...validators) {
        validators.forEach(v => this._init(v, definitions));
        this._addFormatMessages();
    }

    _init(validatorInstance, definitions) {
        validatorInstance.errorsText = this.wrapErrorMessageFn(validatorInstance.errorsText.bind(validatorInstance)).bind(this);// eslint-disable-line
        validatorInstance.addFormat('url', this._validateUrl);
        validatorInstance.addFormat('cron', this._validateCron);
        validatorInstance.addFormat('pipeline-name', this._validatePipelineName);
        validatorInstance.addFormat('experiment-name', this._validateExperimentName);
        validatorInstance.addFormat('algorithm-name', this._validateAlgorithmName);
        validatorInstance.addFormat('algorithm-image', this._validateAlgorithmImage);
        validatorInstance.addFormat('algorithm-mount-pvc', this._validateAlgorithmMountPvc);
        validatorInstance.addFormat('algorithm-memory', this._validateAlgorithmMemory);
        validatorInstance.addFormat('memory', this._validateMemory);
        validatorInstance.addFormat('path', this._validatePath);

        Object.entries(definitions).forEach(([k, v]) => {
            validatorInstance.addSchema(v, `#/components/schemas/${k}`);
        });
    }

    _addFormatMessages() {
        formatMessages.set('pipeline-name', validationMessages.PIPELINE_NAME_FORMAT);
        formatMessages.set('algorithm-name', validationMessages.ALGORITHM_NAME_FORMAT);
        formatMessages.set('algorithm-image', validationMessages.ALGORITHM_IMAGE_FORMAT);
        formatMessages.set('experiment-name', validationMessages.EXPERIMENT_NAME_FORMAT);
    }

    _validateUrl(url) {
        return regex.URL_REGEX.test(url);
    }

    _validatePipelineName(name) {
        return regex.PIPELINE_NAME_REGEX.test(name);
    }

    _validateExperimentName(name) {
        return regex.EXPERIMENT_NAME_REGEX.test(name);
    }

    _validatePath(path) {
        return regex.PATH.test(path);
    }

    _validateAlgorithmName(name) {
        return regex.ALGORITHM_NAME_REGEX.test(name);
    }

    _validateAlgorithmImage(image) {
        return regex.ALGORITHM_IMAGE_REGEX.test(image);
    }

    _validateAlgorithmMountPvc(name) {
        return name && regex.PVC_NAME_REGEX.test(name) && name.length < 64;
    }

    _validateAlgorithmMemory(memory) {
        try {
            const mem = converter.getMemoryInMi(memory);
            if (mem < MIN_MEMORY) {
                throw new InvalidDataError(`memory must be at least ${MIN_MEMORY} Mi`);
            }
        }
        catch (ex) {
            throw new InvalidDataError(ex.message);
        }
        return true;
    }

    _validateMemory(memory) {
        try {
            converter.getMemoryInMi(memory);
        }
        catch (ex) {
            throw new InvalidDataError(ex.message);
        }
        return true;
    }

    _validateCron(cron) {
        let result = true;
        try {
            new CronJob(cron); // eslint-disable-line
        }
        catch (e) {
            result = false;
        }
        return result;
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
