module.exports = {
    formatPipelineName(pipelineName) {
        if (pipelineName.startsWith('raw-')) {
            return 'raw';
        }
        return pipelineName;
    },
    parseBool(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string' && value.toLowerCase() === 'true') {
            return true;
        }
        return false;
    }
};
