const { pipelineKind } = require('@hkube/consts');
const autoScaler = require('../streaming/auto-scaler');

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

    async getResultFromStorage(data) {
        return { data };
    }

    async setResultToStorage() {
        // Nothing to do for now, already handled by wrapper
        return undefined;
    }
}

module.exports = new Storage();
