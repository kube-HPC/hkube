const { nodeKind } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError } = require('../errors');
const stateManager = require('../state/state-manager');

class Gateway {
    async getGateway(options) {
        const { name } = options;
        const gateway = await stateManager.getGateway(options);
        if (!gateway) {
            throw new ResourceNotFoundError('gateway', name);
        }
        return gateway;
    }

    async insertGateway(options) {
        validator.gateways.validateGateway(options);
        const { name, description, mem, jobId, nodeName, algorithmName } = options;
        const gateway = {
            name,
            description,
            mem,
            jobId,
            nodeName,
            algorithmName,
            created: Date.now(),
        };
        await stateManager.createGateway(gateway);
    }

    async gatewaysList(options) {
        const { sort, limit } = options;
        return stateManager.getGateways({ sort, limit });
    }

    async deleteGateway(options) {
        const { name } = options;
        await validator.gateways.validateGatewayExists({ name });
        const res = await stateManager.deleteGatewayByName({ name });
        const message = res.deleted === 0 ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name };
    }

    async deleteGatewaysByJobId({ jobId }) {
        const pipeline = await stateManager.getJobPipeline({ jobId });
        const algorithms = pipeline.nodes.filter(n => n.kind === nodeKind.Gateway).map(n => n.algorithmName);
        await Promise.all(algorithms.map(a => stateManager.deleteAlgorithm({ name: a })));
    }
}

module.exports = new Gateway();
