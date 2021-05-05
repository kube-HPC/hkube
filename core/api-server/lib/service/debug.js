const { nodeKind, buildTypes } = require('@hkube/consts');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');

class Debug {
    init(config) {
        this._debugUrl = config.debugUrl.path;
    }

    async getDebug(options) {
        const { name } = options;
        const algorithmName = `${nodeKind.Debug}-${name}`;
        const debug = await stateManager.getAlgorithm({ name: algorithmName });
        if (!debug) {
            throw new ResourceNotFoundError('gateway', name);
        }
        return debug;
    }

    async getDebugs(options) {
        const { sort, limit } = options;
        return stateManager.getAlgorithms({ sort, limit, kind: nodeKind.Debug });
    }

    async createDebug({ originalAlg: originalAlgName }) {
        const algorithmName = `${nodeKind.Debug}-${originalAlgName}`;
        const debug = await stateManager.getAlgorithm({ name: algorithmName });
        if (debug) {
            throw new InvalidDataError(`debug ${algorithmName} already exists`);
        }
        const originalAlg = await stateManager.getAlgorithm({ name: originalAlgName });
        const debugUrl = `${this._debugUrl}/${originalAlgName}`;
        const algorithm = {
            name: algorithmName,
            debugUrl,
            kind: nodeKind.Debug,
            algorithmImage: 'hkube/noneExisting',
            type: buildTypes.IMAGE,
            env: originalAlg.env,
            options: {
                debug: true,
                pending: false
            }
        };
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName, url: debugUrl };
    }

    async deleteDebugByAlgName({ name }) {
        await stateManager.deleteAlgorithm({
            name
        });
    }
}

module.exports = new Debug();
