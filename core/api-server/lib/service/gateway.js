const objectPath = require('object-path');
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
        const { name, description, mem, jobId, nodeName } = options;
        const gateway = {
            name,
            description,
            mem,
            jobId,
            nodeName,
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
        await this._stopAllCrons(gatewayName);
        await this._cleanAll(gatewayName);
        return this._deleteGateway(options);
    }

    async _deleteGateway(options) {
        const { name } = options;
        const res = await stateManager.deleteGateway({ name });
        const message = res.deleted === 0 ? 'deleted operation has failed' : 'deleted successfully';
        return { message, name };
    }

    _hasCron(pipeline, gatewayName) {
        const enabled = objectPath.get(pipeline, 'triggers.cron.enabled');
        return pipeline.gatewayName === gatewayName && enabled;
    }
}

module.exports = new Gateway();
