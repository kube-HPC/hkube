const Validator = require('ajv');
const { InvalidDataError } = require('../errors');
const customFormats = require('./custom-formats');

const validator = new Validator({
    useDefaults: false,
    coerceTypes: true,
    nullable: true,
});
const defaulter = new Validator({
    useDefaults: true,
    coerceTypes: true,
    nullable: true,
});

class ApiValidator {
    init(schemas) {
        this.definitions = schemas;
        customFormats.init(schemas, validator, defaulter);
    }

    validate(schema, object, useDefaults, options) {
        this._validateInner(defaulter, schema, object, options);
    }

    _validateInner(validatorInstance, schema, obj) {
        const object = obj || {};
        const valid = validatorInstance.validate(schema, object);
        if (!valid) {
            const { errors } = validatorInstance;
            let error = validatorInstance.errorsText(errors, {
                extraInfo: true,
            });
            if (errors[0].params && errors[0].params.allowedValues) {
                error += ` (${errors[0].params.allowedValues.join(',')})`;
            }
            else if (errors[0].params && errors[0].params.additionalProperty) {
                error += ` (${errors[0].params.additionalProperty})`;
            }
            throw new InvalidDataError(error);
        }
    }
}

module.exports = new ApiValidator();
