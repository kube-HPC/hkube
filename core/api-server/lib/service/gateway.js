const { uid } = require('@hkube/uid');
const { nodeKind, buildTypes } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');

class Gateway {
    init(config) {
        this._gatewayUrl = config.gatewayUrl.path;
    }

    async getGateway(options) {
        const { name } = options;
        const algorithmName = `${nodeKind.Gateway}-${name}`;
        const gateway = await stateManager.getAlgorithm({ name: algorithmName });
        if (!gateway) {
            throw new ResourceNotFoundError(nodeKind.Gateway, name);
        }
        return gateway;
    }

    async getGateways(options) {
        const { sort, limit } = options;
        return stateManager.getAlgorithms({ sort, limit, kind: nodeKind.Gateway });
    }

    async createGateway({ jobId, nodeName, spec }) {
        const { name, description, mem, cpu } = spec || {};
        let gatewayName = name;

        if (!gatewayName) {
            gatewayName = uid({ length: 8 });
        }
        const algorithmName = `${nodeKind.Gateway}-${gatewayName}`;
        const gateway = await stateManager.getAlgorithm({ name: algorithmName });
        if (gateway) {
            throw new InvalidDataError(`gateway ${algorithmName} already exists`);
        }
        const gatewayUrl = `${this._gatewayUrl}/${gatewayName}`;
        const algorithm = {
            name: algorithmName,
            gatewayName,
            gatewayUrl,
            mem,
            cpu,
            description,
            jobId,
            nodeName,
            kind: nodeKind.Gateway,
            algorithmImage: 'hkube/algorithm-gateway',
            algorithmEnv: {
                GATEWAY_NAME: gatewayName,
            },
            type: buildTypes.IMAGE,
            options: {
                debug: false,
                pending: false
            }
        };
        validator.gateways.validateGateway(algorithm);
        await stateManager.updateAlgorithm(algorithm);
        return { algorithmName, url: gatewayUrl };
    }

    async deleteGatewaysByJobId({ jobId }) {
        const pipeline = await stateManager.getJobPipeline({ jobId });
        if (pipeline) {
            const algorithms = pipeline.nodes
                .filter(n => n.kind === nodeKind.Gateway)
                .map(n => n.algorithmName);
            await Promise.all(algorithms.map(a => stateManager.deleteAlgorithm({ name: a })));
        }
    }
}

module.exports = new Gateway();
