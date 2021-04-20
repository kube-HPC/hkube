const log = require('@hkube/logger').GetLogFromContanier();
const components = require('../../../lib/consts/componentNames');

const logger = () => (req, res, next) => {
    const route = req.baseUrl + req.route.path;
    const pipelineName = req.body.name || req.params.name;
    const jobId = req.body.jobId || req.params.jobId;
    res._internalMetadata = {
        route,
        jobId,
        pipelineName
    };
    log.info(`request arrived for ${req.method} ${req.originalUrl}`, { component: components.REST_API, route, jobId, pipelineName });
    return next();
};

module.exports = logger;
