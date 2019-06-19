module.exports = {
    formatPipelineName(pipelineName) {
        if (pipelineName.startsWith('raw-')) {
            return 'raw';
        }
        return pipelineName;
    },
    parseBool(value, defaultValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string' && value.toLowerCase() === 'true') {
            return true;
        }
        return defaultValue || false;
    },
    parseInt(value, defaultValue) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            try {
                return parseInt(value, 10);
            }
            catch (error) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
};
