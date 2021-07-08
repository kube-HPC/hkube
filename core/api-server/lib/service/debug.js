const { nodeKind, buildTypes } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');

class Debug extends AlgorithmBase {
    init(config) {
        this._debugUrl = config.debugUrl.path;
    }

    async getDebug(options) {
        return this.get(options);
    }

    async getDebugs(options) {
        this.getAlgorithms(options);
    }

    async createDebug({ jobId, algorithmName }) {
        if (!algorithmName) {
            throw new InvalidDataError('Node for debug must have algorithm name set');
        }
        const newAlgName = `${algorithmName}-${this._kind}`;
        const debug = await stateManager.getAlgorithm({ name: newAlgName });
        if (debug) {
            return { algorithmName: debug.name };
        }
        const originalAlg = await stateManager.getAlgorithm({ name: algorithmName });
        if (!originalAlg) {
            throw new InvalidDataError(`debug ${algorithmName} does not exists`);
        }
        const debugUrl = `${this._debugUrl}/${algorithmName}`;
        const algorithm = {
            cpu: originalAlg.cpu,
            mem: originalAlg.mem,
            name: newAlgName,
            jobId,
            debugUrl,
            debugName: algorithmName,
            kind: nodeKind.Debug,
            algorithmImage: 'hkube/algorithm-debug',
            type: buildTypes.IMAGE,
            options: {
                pending: false
            },
            maxWorkers: 1
        };
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName: newAlgName };
    }

    async deleteDebug({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Debug(nodeKind.Debug);
