const { pipelineKind } = require('@hkube/consts');
const autoScaler = require('../streaming/auto-scaler');
const discovery = require('../streaming/discovery');

class Storage {
    async start(options) {
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            await autoScaler.start(options);
        }
    }

    async finish(options) {
        await autoScaler.finish(options);
    }

    async getResultFromStorage(jobData) {
        const { parents } = jobData;
        const addresses = discovery.getAddresses(parents);
        const data = { ...jobData, addresses };
        return { data };
    }

    async setResultToStorage() {
        // Nothing to do for now, already handled by wrapper
        return undefined;
    }
}

module.exports = new Storage();
