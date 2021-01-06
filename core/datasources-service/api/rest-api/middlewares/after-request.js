const log = require('@hkube/logger').GetLogFromContanier();
const component = require('../../../lib/consts/componentNames').REST_API;

const logger = (filter = []) => (req, res, next) => {
    if (filter.some(f => req.url.startsWith(f))) {
        return next();
    }
    const { route, jobId, pipelineName } = res._internalMetadata || {};
    log.info(
        `response sent for ${req.method} ${req.originalUrl} ${res.statusCode}`,
        {
            component,
            route,
            jobId,
            pipelineName,
        }
    );
    return next();
};

module.exports = logger;
