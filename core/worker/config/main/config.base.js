
const config = module.exports = {};

config.serviceName = 'workers';
const useCluster = process.env.REDIS_CLUSTER_SERVICE_HOST ? true : false;

config.redis = {
    host: useCluster ? process.env.REDIS_CLUSTER_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useCluster ? process.env.REDIS_CLUSTER_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    useCluster: useCluster
};

config.workerCommunication = {
    adapterName: 'socket',
    config: {
        connection: {
            port: process.env.WORKER_SOCKET_PORT || 3000
        }
    }
}

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
}

config.jobConsumer = {
    job: {
        type: process.env.JOB_TYPE || 'green-alg'
    },
    setting: {
        queueName: 'queue-workers',
        prefix: 'jobs-workers'
    }
}

config.inputAdapters = {
    storagePath: process.env.SHARED_STORAGE_PATH || './sharedStorage'
}