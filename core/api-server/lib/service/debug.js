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

    async createDebug({ algorithmName: originalAlgName }) {
        const algorithmName = `${originalAlgName}-${this._kind}`;
        const debug = await stateManager.getAlgorithm({ name: algorithmName });
        if (debug) {
            throw new InvalidDataError(`debug ${algorithmName} already exists`);
        }
        const originalAlg = await stateManager.getAlgorithm({ name: originalAlgName });
        if (!originalAlg) {
            throw new InvalidDataError(`debug ${originalAlgName} does not exists`);
        }
        const debugUrl = `${this._debugUrl}/${originalAlgName}`;
        const algorithm = {
            cpu: originalAlg.cpu,
            mem: originalAlg.mem,
            name: algorithmName,
            debugUrl,
            kind: nodeKind.Debug,
            algorithmImage: 'hkube/algorithm-debug:v2.0.2',
            type: buildTypes.IMAGE,
            options: {
                debug: false,
                pending: false
            }
        };
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName, url: debugUrl };
    }

    async deleteDebug({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Debug(nodeKind.Debug);
