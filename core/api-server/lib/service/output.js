const { nodeKind, buildTypes } = require('@hkube/consts');
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
            throw new InvalidDataError(`output ${algorithmName} already exists`);
        }
        const algorithm = {
            name: algorithmName,
            mem,
            description,
            jobId,
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

    async deleteOutputs({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Output(nodeKind.Output);
