const { uid } = require('@hkube/uid');
const { nodeKind, buildTypes } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const { InvalidDataError } = require('../errors');
const stateManager = require('../state/state-manager');
const AlgorithmBase = require('./algorithmBase');
class Gateway extends AlgorithmBase {
    init(config) {
        this._gatewayUrl = config.gatewayUrl.path;
    }

    async getGateway(options) {
        return this.get(options);
    }

    async getGateways(options) {
        return this.getAlgorithms(options);
    }

    async createGateway({ jobId, nodeName, spec }) {
        const { name, description, mem, cpu } = spec || {};
        let gatewayName = name;

        if (!gatewayName) {
            gatewayName = uid({ length: 8 });
        }
        const algorithmName = `${gatewayName}-${nodeKind.Gateway}`;
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

    async deleteGateways({ pipeline, jobId }) {
        await this.deleteAlgorithms({ pipeline, jobId });
    }
}

module.exports = new Gateway(nodeKind.Gateway);
