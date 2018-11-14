module.exports = {
    /**
     * Convert raw pipeline names to 'raw' (to enable rate them in prometheus)
     * @param {string} pipelineName
     */
    formatPipelineName(pipelineName) {
        if (pipelineName.startsWith('raw-')) {
            return 'raw';
        }
        return pipelineName;
    }
};
