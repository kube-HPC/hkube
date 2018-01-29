const log = require('@hkube/logger').GetLogFromContanier();
const componentName = require('../../../common/consts/componentNames');

const logger = (filter = []) => (req, res, next) => {
    if (filter.includes(req.url)) {
        return next();
    }
    log.info(`response sent for ${req.method} ${req.url} ${res.statusCode}`, { component: componentName.REST_API });
    return next();
};

module.exports = logger;
