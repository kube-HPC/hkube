module.exports = {
    parseBool(value, defaultValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
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
            } catch (error) {
                return defaultValue;
            }
        }
        return defaultValue;
    },
};
