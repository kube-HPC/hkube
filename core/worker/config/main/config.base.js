const config = {};

config.serviceName = 'workers';
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
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
        etcd: {
            host: process.env.ETCD_CLIENT_SERVICE_HOST || 'localhost',
            port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
        },
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

config.k8s = {
    pod_name: process.env.POD_NAME
};

config.datastoreAdapter = {
    connection: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
    },
    moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
};

module.exports = config;
