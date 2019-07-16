const logWrapper = (method, instance, log) => {
    return (...args) => {
        log.debug(`${method.name} start`);
        const ret = method.apply(instance, args);
        log.debug(`${method.name} end`);
        return ret;
    };
}

module.exports = {
    logWrapper
};
