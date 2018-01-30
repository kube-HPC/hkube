const log = require('@hkube/logger').GetLogFromContanier();
const componentName = require('../../../common/consts/componentNames');

const logger = (filter = []) => (req, res, next) => {
    if (filter.some(f => req.url.startsWith(f))) {
        return next();
    }
    const { jobId } = res;
    log.info(`response sent for ${req.method} ${req.url} ${res.statusCode}`, { component: componentName.REST_API, jobId });
    return next();
};

module.exports = logger;
