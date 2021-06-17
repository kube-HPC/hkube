const { nodeKind } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateUpdatePipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, true, { validateStateType: false });
        this.validatePipelineNodes(pipeline);
    }

    validatePipelineName(name) {
        this._validator.validate(this._validator.definitions.pipelineName, name, false);
    }

    validatePipelineNodes(pipeline) {
        if (!pipeline.nodes?.length) {
            throw new InvalidDataError('pipeline must have at nodes property with at least one node');
        }
        else {
            pipeline.nodes.forEach((node) => {
                if (node.kind === nodeKind.Debug && (!node.algorithmName || node.algorithmNam === '')) {
                    throw new InvalidDataError('Node for debug must have algorithm name set');
                }
            });
        }
    }
}

module.exports = ApiValidator;
