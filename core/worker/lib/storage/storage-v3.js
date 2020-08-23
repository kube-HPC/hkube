const { pipelineKind } = require('@hkube/consts');
const streamHandler = require('../streaming/services/stream-handler');

class Storage {
    async start(options) {
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            await streamHandler.start(options);
        }
    }

    async finish(options) {
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            await streamHandler.finish(options);
        }
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
