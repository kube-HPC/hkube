const log = require('@hkube/logger').GetLogFromContanier();
const componentName = require('../../../common/consts/componentNames');

const logger = (req, res, next) => {
    log.info(`request arrived for ${req.method} ${req.url}`, { component: componentName.REST_API });
    return next();
};

module.exports = logger;
