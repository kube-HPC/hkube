
const validator = require('djsv');
const schemas = require('api/rest-api/swagger.json').definitions;
const { InvalidDataError, } = require('lib/errors/errors');

class Validator {

    constructor() {
        validator.addFormat('url', '(http|ftp|https)://[\w-]+(\.[\w-]+)*([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?')
        Object.values(schemas).forEach((s) => {
            if (s.id) {
                validator.addSchema(s);
            }
        });
    }

    validateRunRawPipeline(pipeline) {
        return this._validate(schemas.pipeline, pipeline);
    }

    validateRunStoredPipeline(pipeline) {
        return this._validate(schemas.runStoredPipeline, pipeline);
    }

    validateUpdatePipeline(pipeline) {
        return this._validate(schemas.updatePipeline, pipeline);
    }

    validateDeletePipeline(pipeline) {
        return this._validate(schema.pipelineName, pipeline);
    }

    validateInsertPipeline(pipeline) {
        return this._validate(schema.pipeline, pipeline);
    }

    validateGetPipeline(pipeline) {
        return this._validate(schema.pipelineName, pipeline);
    }

    validateExecutionJob(pipeline) {
        return this._validate(schema.executionJob, pipeline);
    }

    _validate(schema, object) {
        const res = validator(schema, object);
        if (!res.valid) {
            throw new InvalidDataError(res.error);
        }
    }
}

module.exports = new Validator();
