
const validator = require('djsv');
const schemas = require('api/rest-api/swagger.json').definitions;
const { InvalidDataError, } = require('lib/errors/errors');

class Validator {

    constructor() {
        //validator.addFormat('url', '(http|ftp|https)://[\w-]+(\.[\w-]+)*([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?')
        Object.values(schemas).forEach((s) => {
            if (s.id) {
                validator.addSchema(s);
            }
        });
    }

    validateRunRawPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(schemas.runStoredPipeline, pipeline);
    }

    validateStopPipeline(pipeline) {
        this._validate(schemas.stopRequest, pipeline);
    }

    validateUpdatePipeline(pipeline) {
        this._validate(schemas.updatePipeline, pipeline);
    }

    validateDeletePipeline(pipeline) {
        this._validate(schemas.pipelineName, pipeline);
    }

    validateInsertPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateGetPipeline(pipeline) {
        this._validate(schemas.pipelineName, pipeline);
    }

    validateExecutionID(pipeline) {
        this._validate(schemas.executionID, pipeline);
    }

    _validate(schema, object) {
        const res = validator(schema, object);
        if (!res.valid) {
            throw new InvalidDataError(res.error);
        }
        if (object.nodes) {
            this._validateNodes(object.nodes);
        }
    }

    _validateNodes(nodes) {
        const duplicates = [];
        nodes.forEach((node, index) => {
            if (node.nodeName === 'flowInput') {
                throw new InvalidDataError(`node ${node.nodeName} has invalid reserved name flowInput`);
            }
            if (node.nodeName.indexOf(node, index + 1) > -1) {
                if (duplicates.indexOf(node) === -1) {
                    duplicates.push(node);
                }
            }
        });
        if (duplicates.length > 0) {
            throw new InvalidDataError(`found duplicate nodes ${duplicates.join(',')}`);
        }
    }
}

module.exports = new Validator();
