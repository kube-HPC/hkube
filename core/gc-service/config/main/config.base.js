const path = require('path');
const config = {};
const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');

config.version = packageJson.version;
config.serviceName = packageJson.name;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';
config.ingressPrefix = process.env.INGRESS_PREFIX || '';
const secured = !!process.env.IS_SSL;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.rest = {
    port: formatter.parseInt(process.env.REST_PORT, 7000),
    prefix: 'api/v1',
    poweredBy: 'HKube GC',
    bodySizeLimit: process.env.BODY_SIZE_LIMIT || '50mb'
};

config.swagger = {
    protocol: secured ? 'https' : 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: process.env.BASE_URL_PATH ? path.join(config.ingressPrefix, process.env.BASE_URL_PATH) : config.ingressPrefix
};

config.cleanerSettings = {
    datasource: {
        cron: process.env.DATASOURCE_CRON || '0 0 * * *',
        enabled: formatter.parseBool(process.env.DATASOURCE_ENABLED, true),
        settings: {
            clusterName: config.clusterName,
            fs: {
                baseDatasourcesDirectory: process.env.DATASOURCE_BASE_DIRECTORY || '/var/tmp/fs/datasources-storage',
            },
            directories: {
                dataSourcesInUse: process.env.DATASOURCE_FOLDER_IN_USE || 'dataSources-in-use',
            },
            maxAge: formatter.parseFloat(process.env.DATASOURCE_MAX_AGE, 0.166),
        }
    },
    debug: {
        cron: process.env.DEBUG_CRON || '*/2 * * * *',
        enabled: formatter.parseBool(process.env.DEBUG_ENABLED, true),
        settings: {
            maxAge: formatter.parseFloat(process.env.DEBUG_MAX_AGE, 0.166)
        }
    },
    etcd: {
        cron: process.env.ETCD_CRON || '0 1 * * *',
        enabled: formatter.parseBool(process.env.ETCD_ENABLED, true),
        settings: {
            maxAge: formatter.parseFloat(process.env.ETCD_MAX_AGE, 1 * 60 * 24),
        }
    },
    gateway: {
        cron: process.env.GATEWAY_CRON || '*/2 * * * *',
        enabled: formatter.parseBool(process.env.GATEWAY_ENABLED, true),
        settings: {
            maxAge: formatter.parseFloat(process.env.GATEWAY_MAX_AGE, 0.166)
        }
    },
    jobs: {
        cron: process.env.JOBS_CRON || '*/1 * * * *',
        enabled: formatter.parseBool(process.env.JOBS_ENABLED, true),
        settings: {
            maxAge: {
                completedMaxAge: formatter.parseFloat(process.env.JOBS_COMPLETED_MAX_AGE, 1),
                failedMaxAge: formatter.parseFloat(process.env.JOBS_FAILED_MAX_AGE, 1),
                pendingMaxAge: formatter.parseFloat(process.env.JOBS_PENDING_MAX_AGE, 1),
            }
        }
    },
    pipelines: {
        cron: process.env.PIPELINES_CRON || '*/5 * * * *',
        enabled: formatter.parseBool(process.env.PIPELINES_ENABLED, true),
        settings: {
            apiServer: {
                protocol: 'http',
                host: process.env.API_SERVER_SERVICE_HOST || 'localhost',
                port: process.env.API_SERVER_SERVICE_PORT || 3000,
                stopPath: 'internal/v1/exec/stop'
            }
        }
    },
    redis: {
        cron: process.env.REDIS_CRON || '20 1 * * *',
        enabled: formatter.parseBool(process.env.REDIS_ENABLED, true),
        settings: {
            maxAge: formatter.parseFloat(process.env.REDIS_MAX_AGE, 5 * 60 * 24),
        }
    },
    storage: {
        cron: process.env.STORAGE_CRON || '0 2 * * *',
        enabled: formatter.parseBool(process.env.STORAGE_ENABLED, true),
        settings: {
            maxAge: {
                results: formatter.parseFloat(process.env.STORAGE_RESULT_MAX_AGE, 10 * 60 * 24),
                temp: formatter.parseFloat(process.env.STORAGE_TEMP_MAX_AGE, 5 * 60 * 24)
            }
        }
    },
};

config.healthchecksInterval = formatter.parseInt(process.env.HEALTH_CHECK_INTERVAL, 10000);

config.healthchecks = {
    path: process.env.HEALTH_CHECK_PATH || '/healthz',
    port: formatter.parseInt(process.env.HEALTH_CHECK_PORT, 5000),
    maxDiff: formatter.parseInt(process.env.HEALTHCHECK_MAX_DIFF, 30000),
    enabled: formatter.parseBool(process.env.HEALTHCHECKS_ENABLE, true)
};

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    timeout: process.env.KUBERNETES_SERVICE_TIMEOUT || 60000
};

config.db = {
    provider: 'mongo',
    mongo: {
        auth: {
            user: process.env.MONGODB_SERVICE_USER_NAME || 'tester',
            password: process.env.MONGODB_SERVICE_PASSWORD || 'password',
        },
        host: process.env.MONGODB_SERVICE_HOST || 'localhost',
        port: formatter.parseInt(process.env.MONGODB_SERVICE_PORT, 27017),
        dbName: process.env.MONGODB_DB_NAME || 'hkube',
    }
};

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
};

config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage'
};

config.storageAdapters = {
    s3: {
        connection: config.s3,
        encoding: process.env.STORAGE_ENCODING || 'bson',
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
        encoding: process.env.STORAGE_ENCODING || 'bson',
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
