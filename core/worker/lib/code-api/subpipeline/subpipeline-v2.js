class SubPipelineHandler {
    async getResultFromStorage(options) {
        const { result } = options;
        return result;
    }
}

module.exports = new SubPipelineHandler();
