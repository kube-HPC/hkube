const Validator = require('ajv');
const merge = require('lodash.merge');
const { NodesMap: DAG } = require('@hkube/dag');
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
    init(schemas, schemasInternal) {
        this.definitions = schemas;
        this.definitionsInternal = schemasInternal;
        customFormats.init(schemas, validator, defaulter);
    }

    addDefaults(schema, object) {
        defaulter.validate(schema, object);
    }

    validate(schema, object, useDefaults, options) {
        if (useDefaults) {
            this._validateInner(defaulter, schema, object, options);
        } else {
            this._validateInner(validator, schema, object, options);
        }
    }

    _validateInner(validatorInstance, schema, obj, options = {}) {
        const object = obj || {};
        const valid = validatorInstance.validate(schema, object);
        if (!valid) {
            const { errors } = validatorInstance;
            let error = validatorInstance.errorsText(errors, {
                extraInfo: true,
            });
            if (errors[0].params && errors[0].params.allowedValues) {
                error += ` (${errors[0].params.allowedValues.join(',')})`;
            } else if (
                errors[0].params &&
                errors[0].params.additionalProperty
            ) {
                error += ` (${errors[0].params.additionalProperty})`;
            }
            throw new InvalidDataError(error);
        }
        const config = merge({}, { validateNodes: true }, options);
        if (object.nodes && config.validateNodes) {
            this._validateNodes(object, config);
        }
    }

    _validateNodes(pipeline, options) {
        try {
            new DAG(pipeline, options); // eslint-disable-line
        } catch (e) {
            throw new InvalidDataError(e.message);
        }
    }
}

module.exports = new ApiValidator();
