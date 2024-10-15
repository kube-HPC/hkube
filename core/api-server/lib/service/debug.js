const { nodeKind, buildTypes } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');
const versionsService = require('./algorithm-versions');

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

    async createDebug({ algorithmName }) {
        if (!algorithmName) {
            throw new InvalidDataError('Node for debug must have algorithm name set');
        }
        const originalAlg = await stateManager.getAlgorithm({ name: algorithmName });
        if (!originalAlg) {
            throw new InvalidDataError(`debug ${algorithmName} does not exists`);
        }
        if (originalAlg.kind === nodeKind.Debug) {
            return { algorithmName };
        }
        const newAlgName = `${algorithmName}-${this._kind}`;
        const debug = await stateManager.getAlgorithm({ name: newAlgName });
        if (debug) {
            // update to set the last modified timestamp
            await stateManager.updateAlgorithm(debug);
            return { algorithmName: debug.name };
        }
        const debugUrl = `${this._debugUrl}/${algorithmName}`;
        const algorithm = {
            cpu: originalAlg.cpu,
            mem: originalAlg.mem,
            name: newAlgName,
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
        const version = await versionsService.createVersion(algorithm);
        await stateManager.updateAlgorithm({ ...algorithm, version });
        return { algorithmName: newAlgName };
    }

    async updateLastUsed({ pipeline, jobId }) {
        if (!pipeline) {
            // eslint-disable-next-line no-param-reassign
            pipeline = await stateManager.getJobPipeline({ jobId });
        }
        if (!pipeline.nodes) {
            return;
        }
        const debugAlgorithms = await Promise.all(pipeline.nodes.filter(n => n.kind === nodeKind.Debug).map(n => stateManager.getAlgorithm({ name: n.algorithmName })));
        await Promise.all(debugAlgorithms.map(a => stateManager.updateAlgorithm(a)));
    }

    async deleteDebug({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Debug(nodeKind.Debug);
