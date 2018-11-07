const packageJson = require(process.cwd() + '/package.json');
const config = {};

config.serviceName = packageJson.name;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.apiServer = {
    protocol: 'http',
    host: process.env.API_SERVER_SERVICE_HOST || 'localhost',
    port: process.env.API_SERVER_SERVICE_PORT || 3000,
    basePath: 'internal/v1/exec/'
};

config.workerCommunication = {
    adapterName: 'socket',
    config: {
        connection: {
            port: process.env.WORKER_SOCKET_PORT || 3000
        }
    }
};

config.etcdDiscovery = {
    init: {
        etcd: config.etcd,
        serviceName: config.serviceName
    },
    register: {
        // use defaults for now
    }
};

config.jobConsumer = {
    job: {
        type: process.env.ALGORITHM_TYPE
    },
    setting: {
        prefix: 'jobs-workers',
        settings: {
            maxStalledCount: 3
        }
    }
};

config.pollingInterval = process.env.POLLING_INTERVAL || 100; // The polling interval is the period of time between jobs in ms.

config.timeouts = {
    stop: 10000 // timeout to stop the algorithm in ms
};

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};

config.tracer = {
    tracerConfig: {
        serviceName: config.serviceName,
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
        }
    }
};


config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    pod_name: process.env.POD_NAME
};
config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
};

config.fs = {
    baseDirectory: process.env.FS_DIRECTORY || '/var/tmp/fs/storage'
}

config.storageAdapters = {
    s3: {
        connection: config.s3,
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    etcd: {
        connection: config.etcd,
        moduleName: process.env.STORAGE_MODULE || '@hkube/etcd-adapter'
    },
    redis: {
        connection: config.redis,
        moduleName: process.env.STORAGE_MODULE || '@hkube/redis-storage-adapter'
    },
    fs: {
        connection: config.fs,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
