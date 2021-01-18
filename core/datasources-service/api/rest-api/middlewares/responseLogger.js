const log = require('@hkube/logger').GetLogFromContanier();
const component = require('../../../lib/consts/componentNames').REST_API;

const logger = (blackListedUrls = []) => (req, res, next) => {
    next();

    if (blackListedUrls.some(url => req.originalUrl.startsWith(url))) return;

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
};

module.exports = logger;
