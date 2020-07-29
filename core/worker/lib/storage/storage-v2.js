const { pipelineKind } = require('@hkube/consts');

class Storage {
    async start(options) {
        let error;
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            error = `${kind} is not supported in this algorithm`;
        }
        return { error };
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
