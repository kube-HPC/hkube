// const path = require('path');
const uuid = require('uuid/v4');
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
        queueName: 'queue-workers',
        prefix: 'jobs-workers'
    }
};

config.timeouts = {
    stop: 10000 // timeout to stop the algorithm in ms
};

config.inputAdapters = {
    storagePath: process.env.SHARED_STORAGE_PATH || './sharedStorage'
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
}

// config.algorunnerLogging = {
//     algorunnerLogFileName: process.env.ALGORITHM_LOG_FILE_NAME || 'algorunner_0.log',
//     baseLogsPath: path.join((process.env.BASE_LOGS_PATH || '/var/log/pods'), (process.env.POD_ID || ''))
// };
module.exports = config;
