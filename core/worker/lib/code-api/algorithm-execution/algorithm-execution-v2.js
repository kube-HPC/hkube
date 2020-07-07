class AlgorithmExecution {
    async setInputToStorage(options) {
        const { storageInput, input } = options;
        return storageInput || input;
    }

    async getResultFromStorage(options) {
        const { result } = options;
        return result;
    }
}

module.exports = new AlgorithmExecution();
