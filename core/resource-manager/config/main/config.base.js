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

config.metrics = [
    {
        name: 'templates-store',
        weight: 0.1,
        adapter: {
            connection: {
                host: '',
                port: 9876
            }
        }
    },
    {
        name: 'algorithm-queue',
        weight: 0.1,
        adapter: {
            connection: {
                host: '',
                port: 9876
            }
        }
    },
    {
        name: 'kubernetes',
        weight: 0.8,
        cache: '5m',
        adapter: {
            connection: {
                host: '',
                port: 9876
            }
        },
    }
]