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
        pipeline.nodes.forEach(node => {
            if (node.kind === nodeKind.DataSource) {
                if (!node.dataSource) {
                    throw new InvalidDataError('you must provide a valid dataSource');
                }
            }
        });
    }
}

module.exports = ApiValidator;
