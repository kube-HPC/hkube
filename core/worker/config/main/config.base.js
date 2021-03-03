const packageJson = require(process.cwd() + '/package.json');
const formatters = require(process.cwd() + '/lib/helpers/formatters');
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

const config = {};

config.serviceName = packageJson.name;
config.version = packageJson.version;

config.clusterName = process.env.CLUSTER_NAME || 'local';
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
const storageEncoding = process.env.STORAGE_ENCODING || 'bson';

config.hotWorker = formatters.parseBool(process.env.HOT_WORKER);
config.debugMode = formatters.parseBool(process.env.DEBUG_MODE);
config.devMode = formatters.parseBool(process.env.DEV_MODE);

config.workerImage = process.env.WORKER_IMAGE;
config.algorithmImage = process.env.ALGORITHM_IMAGE;
config.algorithmVersion = process.env.ALGORITHM_VERSION;

config.pollingInterval = process.env.POLLING_INTERVAL || 100;
config.servingReportInterval = formatters.parseInt(process.env.DISCOVERY_SERVING_REPORT_INTERVAL, 5000);

config.streaming = {
    autoScaler: {
        interval: formatters.parseInt(process.env.AUTO_SCALER_INTERVAL, 2000),
        scaleInterval: formatters.parseInt(process.env.AUTO_SCALER_SCALE_INTERVAL, 10000),
        minTimeBetweenScales: formatters.parseInt(process.env.AUTO_SCALER_MIN_TIME_BETWEEN_SCALE, 30000),
        minTimeWaitBeforeRetryScale: formatters.parseInt(process.env.AUTO_SCALER_MIN_TIME_WAIT_BEFORE_RETRY, 60000),
        statistics: {
            maxSizeWindow: formatters.parseInt(process.env.AUTO_SCALER_WINDOW_SIZE, 10),
            minTimeNonStatsReport: formatters.parseInt(process.env.AUTO_SCALER_NON_STATS_REPORT, 10000),
        },
        scaleUp: {
            maxScaleUpReplicas: formatters.parseInt(process.env.AUTO_SCALER_MAX_REPLICAS, 30),
            maxScaleUpReplicasPerScale: formatters.parseInt(process.env.AUTO_SCALER_MAX_REPLICAS_PER_SCALE, 10),
            replicasOnFirstScale: formatters.parseInt(process.env.AUTO_SCALER_REPLICAS_FIRST_SCALE, 1),
        },
        scaleDown: {
            maxTimeIdleBeforeReplicaDown: formatters.parseInt(process.env.AUTO_SCALER_MIN_TIME_WAIT_REPLICA_DOWN, 60000),
        },
        queue: {
            minTimeToCleanUpQueue: formatters.parseInt(process.env.AUTO_SCALER_MIN_TIME_CLEAN_QUEUE, 60),
            minQueueSizeBeforeScaleDown: formatters.parseInt(process.env.AUTO_SCALER_MIN_QUEUE_SIZE_BEFORE_SCALE_DOWN, 20),
            minTimeEmptyToScaleDown: formatters.parseInt(process.env.AUTO_SCALER_MIN_TIME_QUEUE_EMPTY, 60000),
        }
    },
    election: {
        interval: formatters.parseInt(process.env.ELECTION_INTERVAL, 10000),
    },
    metrics: {
        interval: formatters.parseInt(process.env.STREAMING_METRICS_INTERVAL, 2000),
    },
    serviceDiscovery: {
        interval: formatters.parseInt(process.env.SERVICE_DISCOVERY_INTERVAL, 5000),
        timeWaitOnParentsDown: formatters.parseInt(process.env.SERVICE_DISCOVERY_PARENTS_DOWN_TIME_WAIT, 30000),
        address: {
            host: process.env.POD_IP || '127.0.0.1',
            port: process.env.STREAMING_DISCOVERY_PORT || 9022
        }
    }
};

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};

config.db = {
    provider: 'mongo',
    mongo: {
        auth: {
            user: process.env.MONGODB_SERVICE_USER_NAME || 'tester',
            password: process.env.MONGODB_SERVICE_PASSWORD || 'password',
        },
        host: process.env.MONGODB_SERVICE_HOST || 'localhost',
        port: formatters.parseInt(process.env.MONGODB_SERVICE_PORT, 27017),
        dbName: process.env.MONGODB_DB_NAME || 'hkube',
    }
};

config.apiServer = {
    protocol: 'http',
    host: process.env.API_SERVER_SERVICE_HOST || 'localhost',
    port: process.env.API_SERVER_SERVICE_PORT || 3000,
    basePath: 'internal/v1/exec/'
};

config.defaultStorageProtocol = process.env.DEFAULT_STORAGE_PROTOCOL || 'v1';
config.defaultWorkerAlgorithmEncoding = process.env.DEFAULT_WORKER_ALGORITHM_ENCODING || 'json';
config.dataSourcesVolume = process.env.DATASOURCES_IN_USE_FOLDER || 'dataSources-in-use';

config.workerCommunication = {
    adapterName: process.env.WORKER_ALGORITHM_PROTOCOL || 'ws',
    port: process.env.WORKER_SOCKET_PORT || 3000,
    maxPayload: process.env.WORKER_SOCKET_MAX_PAYLOAD_BYTES,
    pingTimeout: formatters.parseInt(process.env.WORKER_SOCKET_PING_TIMEOUT, 30000)
};

config.jobConsumer = {
    job: {
        type: process.env.ALGORITHM_TYPE
    },
    setting: {
        prefix: 'jobs-workers',
        settings: {
            stalledCheck: false
        }
    }
};

config.discovery = {
    host: process.env.POD_IP || '127.0.0.1',
    port: process.env.DISCOVERY_PORT || 9020,
    encoding: process.env.DISCOVERY_ENCODING || 'bson',
    timeout: process.env.DISCOVERY_TIMEOUT || 60000,
    maxCacheSize: process.env.DISCOVERY_MAX_CACHE_SIZE || 500
};

config.timeouts = {
    stop: 10000 // timeout to stop the algorithm in ms
};

config.metrics = {
    prefix: 'hkube_',
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
    pod_name: process.env.POD_NAME,
    podId: process.env.POD_ID
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
};

config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage',
    baseDatasourcesDirectory: process.env.BASE_DATASOURCES_DIRECTORY || '/var/tmp/fs/datasources-storage'
};

config.storageAdapters = {
    s3: {
        connection: config.s3,
        encoding: storageEncoding,
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
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

config.cacheResults = {
    enabled: formatters.parseBool(process.env.CACHE_RESULTS_ENABLE, true),
    updateFrequency: formatters.parseInt(process.env.CACHE_UPDATE_FREQUENCY, 5000)
};
config.disableCache = formatters.parseBool(process.env.DISABLE_WORKER_CACHE, false);
config.algoMetricsDir = process.env.ALGO_METRICS_DIR || '/var/metrics/';

module.exports = config;
