const packageJson = require(process.cwd() + '/package.json');
const config = module.exports = {};

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

config.interval = 1000;

config.resourceThresholds = {
    cpu: 0.8,
    mem: 0.8
};

config.resourceProviders = [
    {
        name: 'templates-store',
        adapter: {
            connection: config.etcd,
            cache: { maxAge: 1000 * 60 * 5 }
        },
        metric: {
            weight: 0.3
        }
    },
    {
        name: 'algorithm-queue',
        adapter: {
            connection: config.etcd,
            cache: { maxAge: 1000 * 5 }
        },
        metric: {
            weight: 0.2
        }
    },
    {
        name: 'k8s',
        adapter: {
            connection: {
                local: !process.env.KUBERNETES_SERVICE_HOST
            },
            cache: { maxAge: 1000 * 60 * 1 }
        },
        metric: {
            weight: 0.2
        }
    },
    {
        name: 'prometheus',
        adapter: {
            connection: {
                endpoint: process.env.PROMETHEUS_ENDPOINT || 'http://10.32.10.6:30909/api/v1'
            },
            cache: { maxAge: 1000 * 60 * 5 }
        },
        metric: {
            weight: 0.3
        }
    }
]