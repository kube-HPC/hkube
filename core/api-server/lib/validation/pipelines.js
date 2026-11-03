const { nodeKind, stateType, pipelineKind } = require('@hkube/consts');
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

    validatePipelineVersion(pipeline) {
        this._validator.validate(this._validator.definitions.applyPipelineVersion, pipeline, false);
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
    }

    _resolveStateType(node, algorithms) {
        if (node.kind === nodeKind.Gateway) {
            return stateType.Stateful;
        }
        return algorithms.get(node.algorithmName)?.stateType || stateType.Stateless;
    }

    validateNodesStateType(pipeline, algorithms) {
        if (pipeline.kind !== pipelineKind.Stream) {
            return;
        }
        pipeline.nodes.forEach((node) => {
            if (!node.stateType) {
                return;
            }
            const resolved = this._resolveStateType(node, algorithms);
            if (node.stateType !== resolved) {
                const source = node.kind === nodeKind.Gateway ? 'gateway' : `algorithm ${node.algorithmName}`;
                throw new InvalidDataError(`node ${node.nodeName} stateType "${node.stateType}" conflicts with ${source} stateType "${resolved}". stateType can only be changed in the algorithm configuration`);
            }
        });
    }

    validateStatelessCounts(pipeline, algorithms) {
        if (pipeline.kind !== pipelineKind.Stream) {
            return;
        }
        pipeline.nodes.forEach((node) => {
            const isStateless = this._resolveStateType(node, algorithms) === stateType.Stateless;
            if (!isStateless && (node.minStatelessCount !== 0 || node.maxStatelessCount)) {
                throw new InvalidDataError(`Nodes which are not stateType=${stateType.Stateless} cant have minStatelessCount or maxStatelessCount`);
            }
            if (isStateless && node.maxStatelessCount >= 0 && node.minStatelessCount > node.maxStatelessCount) {
                throw new InvalidDataError('maxStatelessCount must be greater or equal to minStatelessCount');
            }
        });
    }
}

module.exports = ApiValidator;
