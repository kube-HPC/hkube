const log = require('@hkube/logger').GetLogFromContainer();

const init = async () => {
    log.throttle.info('In output init');
};
const start = async (options) => {
    log.debug('In output start');
    return options.input;
};

const stop = async () => {
    log.info('In output stop');
};

module.exports = {
    start,
    stop,
    init
};
