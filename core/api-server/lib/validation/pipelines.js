const { nodeKind, stateType } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateUpdatePipeline(pipeline) {
        this._validator.validate(this._validator.definitions.pipeline, pipeline, true);
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
        const hyperparamsTuners = pipeline.nodes.filter(n => n.kind === nodeKind.HyperparamsTuner);
        hyperparamsTuners.forEach((node) => {
            this._validator.validate(this._validator.definitions.hyperparamsTuner, node.spec, true);
        });
        const debugOverride = pipeline.options?.debugOverride || [];
        debugOverride.forEach((a) => {
            const algorithm = pipeline.nodes.find(n => n.nodeName === a);
            if (!algorithm) {
                throw new InvalidDataError('debugOverride node not in nodes list');
            }
        });
        if (pipeline.kind === 'stream') {
            const notStatelessNodes = pipeline.nodes.filter(n => n?.stateType !== stateType.Stateless);
            notStatelessNodes.forEach((node) => {
                if (node?.minStatelessCount !== 0 || node?.maxStatelessCount) {
                    throw new InvalidDataError(`Nodes which are not stateType=${stateType.Stateless} cant have minStatelessCount or maxStatelessCount`);
                }
            });
            const statelessNodes = pipeline.nodes.filter(n => n?.stateType === stateType.Stateless && n?.maxStatelessCount >= 0);
            statelessNodes.forEach((node) => {
                if (node.minStatelessCount > node.maxStatelessCount) {
                    throw new InvalidDataError('maxStatelessCount must be greater or equal to minStatelessCount');
                }
            });
        }
    }
}

module.exports = ApiValidator;
