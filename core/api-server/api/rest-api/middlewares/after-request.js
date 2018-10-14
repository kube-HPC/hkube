const log = require('@hkube/logger').GetLogFromContanier();
const componentName = require('../../../lib/consts/componentNames');

const logger = (filter = []) => (req, res, next) => {
    if (filter.some(f => req.url.startsWith(f))) {
        return next();
    }
    const { route, jobId, pipelineName } = res._internalMetadata || {};
    log.info(`response sent for ${req.method} ${req.originalUrl} ${res.statusCode}`, { component: componentName.REST_API, route, jobId, pipelineName });
    return next();
};

module.exports = logger;
