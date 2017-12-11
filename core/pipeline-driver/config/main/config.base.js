var package = require(process.cwd() + '/package.json');
var config = module.exports = {};

config.serviceName = package.name;
const useCluster = process.env.REDIS_CLUSTER_SERVICE_HOST ? true : false;

config.redis = {
    host: useCluster ? process.env.REDIS_CLUSTER_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useCluster ? process.env.REDIS_CLUSTER_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    cluster: useCluster
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.jobsSettings = {
    lockDuration: 10000,
    stalledInterval: 10000,
    maxStalledCount: 3
}

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT || 9876
    }
}