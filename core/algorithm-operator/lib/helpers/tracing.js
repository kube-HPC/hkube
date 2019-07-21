const logWrapper = (method, instance, log) => {
    return async (...args) => {
        log.debug(`${method.name} start`);
        const ret = await method.apply(instance, args);
        log.debug(`${method.name} end`);
        return ret;
    };
};

const logWrappers = (methods, instance, log) => {
    methods.forEach((m) => {
        instance[m] = logWrapper(instance[m], instance, log); // eslint-disable-line no-param-reassign
    });
};

module.exports = {
    logWrapper,
    logWrappers
};
