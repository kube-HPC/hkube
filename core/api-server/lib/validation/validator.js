
const validator = require('djsv');
const schema = require('lib/validation/pipeline.json');
const { InvalidDataError, } = require('lib/errors/errors');

class Validator {

    constructor() {
        Object.values(schema).forEach((s) => {
            if (s.id) {
                // validator.addSchema(s);
            }
        });
    }

    validateUpdatePipeline(pipeline) {
        return this._validate(schema.updatePipeline, pipeline);
    }

    validateDeletePipeline(pipeline) {
        return this._validate(schema.deletePipeline, pipeline);
    }

    validatePipeline(pipeline) {
        return this._validate(schema.pipeline, pipeline);
    }

    _validate(schema, object) {
        const res = validator(schema, object);
        if (!res.valid) {
            throw new InvalidDataError(res.errors[0].message);
        }
    }
}

module.exports = new Validator();
