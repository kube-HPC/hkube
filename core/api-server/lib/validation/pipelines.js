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
            throw new InvalidDataError('pipeline must have at least one node');
        }
        const outputs = pipeline.nodes.filter(n => n.kind === nodeKind.Output);
        if (outputs?.length > 1) {
            throw new InvalidDataError('pipeline can not have more than one output');
        }
        const optimizers = pipeline.nodes.filter(n => n.kind === nodeKind.Optimizer);
        optimizers.forEach((node) => {
            this._validator.validate(this._validator.definitions.optimizer, node.spec, true);
        });
        const debugOverride = pipeline.options?.debugOverride || [];
        debugOverride.forEach((a) => {
            const algorithm = pipeline.nodes.find(n => n.nodeName === a);
            if (!algorithm) {
                throw new InvalidDataError('debugOverride node not in nodes list');
            }
        });
    }
}

module.exports = ApiValidator;
