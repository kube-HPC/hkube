const log = require('@hkube/logger').GetLogFromContanier();
const components = require('../../../common/consts/componentNames');

const logger = (filter = []) => (req, res, next) => {
    if (filter.some(f => req.url.startsWith(f))) {
        return next();
    }
    const pipelineName = req.body.name || req.params.name;
    const jobId = req.body.jobId || req.params.jobId;
    log.info(`request arrived for ${req.method} ${req.url}`, { component: components.REST_API, route: req.url, jobId, pipelineName });
    return next();
};

module.exports = logger;
