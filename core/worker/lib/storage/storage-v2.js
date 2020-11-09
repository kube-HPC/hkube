const { pipelineKind } = require('@hkube/consts');

class Storage {
    async start(options) {
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            throw new Error(`${kind} is not supported in this algorithm`);
        }
    }

    async finish() {
        return null;
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
