const path = require('path');
const packageJson = require(process.cwd() + '/package.json');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;
config.ingressPrefix = process.env.INGRESS_PREFIX || '';

config.rest = {
    port: process.env.ALGORITHM_GATEWAY_REST_PORT || 3005,
    prefix: process.env.GATEWAY_NAME || '',
    poweredBy: 'HKube Gateway Server',
    bodySizeLimit: process.env.BODY_SIZE_LIMIT || '2000mb'
};

const baseUrlPath = process.env.BASE_URL_PATH || '/hkube/gateway';

config.swagger = {
    protocol: 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: baseUrlPath ? path.join(config.ingressPrefix, baseUrlPath) : config.ingressPrefix
};

module.exports = config;
