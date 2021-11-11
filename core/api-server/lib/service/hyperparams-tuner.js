const { nodeKind, buildTypes } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');

class HyperparamsTuner extends AlgorithmBase {
    init() {
    }

    async getHyperparamsTuner(options) {
        return this.get(options);
    }

    async getHyperparamsTuners(options) {
        return this.getAlgorithms(options);
    }

    async createHyperparamsTuner(pipelineName, jobId, spec) {
        const { description } = spec || {};
        const algorithmName = `${pipelineName}-${nodeKind.HyperparamsTuner.toLowerCase()}`;
        const hyperparamsTuner = await stateManager.getAlgorithm({ name: algorithmName });
        if (hyperparamsTuner) {
            throw new InvalidDataError(`HyperparamsTuner ${algorithmName} already exists`);
        }
        const algorithm = {
            name: algorithmName,
            description,
            jobId,
            kind: nodeKind.HyperparamsTuner,
            algorithmImage: 'hkube/algorithm-hyperparams-tuner',
            type: buildTypes.IMAGE,
            options: {
                pending: false
            },
            maxWorkers: 1
        };
        validator.hyperparamsTuner.validateHyperparamsTuner(algorithm, spec);
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName };
    }

    async deleteHyperparamsTuners({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new HyperparamsTuner(nodeKind.HyperparamsTuner);
