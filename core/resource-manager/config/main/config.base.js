var packageJson = require(process.cwd() + '/package.json');
var config = module.exports = {};

config.serviceName = packageJson.name;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.k8s = {
    host: process.env.KUBERNETES_SERVICE_HOST || 'https://10.32.10.6',
    port: process.env.KUBERNETES_SERVICE_PORT || 6443,
    user: process.env.KUBERNETES_SERVICE_USER || 'kube',
    pass: process.env.KUBERNETES_SERVICE_PASS || 'ubadmin',
    local: !process.env.KUBERNETES_SERVICE_HOST
}

config.interval = 1000;

config.metrics = [
    {
        name: 'templates-store',
        weight: 0.3
    },
    {
        name: 'algorithm-queue',
        weight: 0.2
    },
    {
        name: 'k8s',
        weight: 0.2
    },
    {
        name: 'prometheus',
        weight: 0.3
    }
]