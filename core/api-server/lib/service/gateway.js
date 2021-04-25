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
        validator.gateways.validateGatewayName(options);
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
        const { name: gatewayName } = options;
        await validator.gateways.validateGatewayExists({ gatewayName });
        return this._deleteGateway(options);
    }

    async _deleteGateway(options) {
        const { name } = options;
        const res = await stateManager.deleteGateway({ name });
        const message = res.deleted === 0 ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name };
    }
}

module.exports = new Gateway();
