const objectPath = require('object-path');
const validator = require('../validation/api-validator');
const executionService = require('./execution');
const cronService = require('./cron');
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
        const gateway = {
            name: options.name,
            description: options.description,
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

    async _stopAllCrons(gatewayName) {
        const pipelines = await stateManager.searchPipelines({
            gatewayName,
            hasCronEnabled: true,
        });
        await Promise.all(pipelines.map(p => cronService.updateCronJob(p, { enabled: false })));
    }

    _hasCron(pipeline, gatewayName) {
        const enabled = objectPath.get(pipeline, 'triggers.cron.enabled');
        return pipeline.gatewayName === gatewayName && enabled;
    }

    async _cleanAll(gatewayName) {
        const pipelines = await stateManager.searchJobs({ gatewayName, fields: { jobId: true } });
        await Promise.all(pipelines.map(p => executionService.cleanJob({ jobId: p.jobId })));
    }
}

module.exports = new Gateway();
