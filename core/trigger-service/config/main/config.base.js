const pkg = require(process.cwd() + '/package.json'); // eslint-disable-line
const config = {};

config.serviceName = pkg.name;

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.apiServer = {
    protocol: 'http',
    host: process.env.API_SERVER_SERVICE_HOST || 'localhost',
    port: process.env.API_SERVER_SERVICE_PORT || 3000,
    path: 'internal/v1/exec/stored'
};

module.exports = config;
