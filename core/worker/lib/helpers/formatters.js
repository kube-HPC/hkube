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
