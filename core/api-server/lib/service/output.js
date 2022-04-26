const { nodeKind, buildTypes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContanier();
const validator = require('../validation/api-validator');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');

class Output extends AlgorithmBase {
    init() {
    }

    async getOutput(options) {
        return this.get(options);
    }

    async getOutputs(options) {
        return this.getAlgorithms(options);
    }

    async createOutput(pipelineName, jobId, spec) {
        const { description, mem } = spec || {};
        const algorithmName = `${pipelineName}-${nodeKind.Output}`;
        const output = await stateManager.getAlgorithm({ name: algorithmName });
        if (output) {
            if (output.kind !== nodeKind.Output) {
                throw new InvalidDataError(`output ${algorithmName} already exists`);
            }
            return { algorithmName };
        }
        const algorithm = {
            name: algorithmName,
            mem,
            description,
            kind: nodeKind.Output,
            algorithmImage: 'hkube/algorithm-output',
            type: buildTypes.IMAGE,
            options: {
                pending: false
            },
            maxWorkers: 1
        };
        validator.outputs.validateOutput(algorithm);
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName };
    }

    async updateLastUsed({ pipeline, jobId }) {
        try {
            if (!pipeline) {
                // eslint-disable-next-line no-param-reassign
                pipeline = await stateManager.getJobPipeline({ jobId });
            }
            if (!pipeline.nodes) {
                return;
            }
            const outputNode = pipeline.nodes.find(n => n.kind === nodeKind.Output);
            if (!outputNode) {
                return;
            }
            const { algorithmName } = outputNode;
            const algorithm = await stateManager.getAlgorithm({ name: algorithmName });
            await stateManager.updateAlgorithm({ ...algorithm });
        }
        catch (error) {
            log.warning(`failed to update last used for output ${error.message}`);
        }
    }

    async deleteOutputs({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Output(nodeKind.Output);
