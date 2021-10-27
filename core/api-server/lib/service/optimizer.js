const { nodeKind, buildTypes } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');

class Optimizer extends AlgorithmBase {
    init() {
    }

    async getOptimizer(options) {
        return this.get(options);
    }

    async getOptimizers(options) {
        return this.getAlgorithms(options);
    }

    async createOptimizer(pipelineName, jobId, spec) {
        const { description } = spec || {};
        const algorithmName = `${pipelineName}-${nodeKind.Optimizer}`;
        const optimizer = await stateManager.getAlgorithm({ name: algorithmName });
        if (optimizer) {
            throw new InvalidDataError(`optimizer ${algorithmName} already exists`);
        }
        const algorithm = {
            name: algorithmName,
            description,
            jobId,
            kind: nodeKind.Optimizer,
            algorithmImage: 'hkube/algorithm-optimizer',
            type: buildTypes.IMAGE,
            options: {
                pending: false
            },
            maxWorkers: 1
        };
        validator.optimizers.validateOptimizer(algorithm, spec);
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName };
    }

    async deleteOptimizers({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Optimizer(nodeKind.Optimizer);
