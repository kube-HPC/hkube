const path = require('path');
const packageJson = require(process.cwd() + '/package.json');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;
config.ingressPrefix = process.env.INGRESS_PREFIX || '';

config.rest = {
    port: process.env.ALGORITHM_GATEWAY_REST_PORT || 3005,
    poweredBy: 'HKube Gateway Server',
};

config.swagger = {
    protocol: 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: process.env.BASE_URL_PATH ? path.join(config.ingressPrefix, process.env.BASE_URL_PATH) : config.ingressPrefix
};

module.exports = config;
