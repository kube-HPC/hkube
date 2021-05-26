const { ResourceNotFoundError } = require('../errors');
const stateManager = require('../state/state-manager');

class AlgorithmBase {
    constructor(kind) {
        this._kind = kind;
    }

    init(config) {
        this._gatewayUrl = config.gatewayUrl.path;
    }

    async get(options) {
        const { name } = options;
        const algorithmName = `${name}-${this._kind}`;
        const algorithm = await stateManager.getAlgorithm({ name: algorithmName });
        if (!algorithm) {
            throw new ResourceNotFoundError(this._kind, name);
        }
        return algorithm;
    }

    async getAlgorithms(options) {
        const { sort, limit } = options;
        return stateManager.getAlgorithms({ sort, limit, kind: this._kind });
    }

    async deleteAlgorithms({ pipeline, jobId }) {
        if (!pipeline) {
            // eslint-disable-next-line no-param-reassign
            pipeline = await stateManager.getJobPipeline({ jobId });
        }
        if (pipeline.nodes) {
            const algorithms = pipeline.nodes
                .filter(n => n.kind === this._kind)
                .map(n => n.algorithmName);
            await Promise.all(algorithms.map(a => stateManager.deleteAlgorithm({ name: a, kind: this._kind })));
        }
    }
}

module.exports = AlgorithmBase;
