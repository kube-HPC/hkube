const packageJson = require(process.cwd() + '/package.json');
const config = module.exports = {};

config.serviceName = packageJson.name;
config.version = packageJson.version;
config.intervalMs = process.env.INTERVAL_MS || 10000;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    version: '1.9'
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};