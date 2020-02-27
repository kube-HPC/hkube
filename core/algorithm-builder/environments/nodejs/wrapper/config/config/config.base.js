const config = module.exports = {};
config.clusterName = process.env.CLUSTER_NAME || 'local';
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';

config.socket = {
    port: process.env.WORKER_SOCKET_PORT || 3000,
    host: process.env.WORKER_SOCKET_HOST || 'localhost',
    protocol: process.env.WORKER_SOCKET_PROTOCOL || 'ws',
    url: process.env.WORKER_SOCKET_URL || null,
    binary: !!process.env.WORKER_BINARY

};

config.socket.encoding = config.socket.binary ? 'bson' : 'json';

config.algorithm = {
    path: process.env.ALGORITHM_PATH || 'algorithm_unique_folder',
    entryPoint: process.env.ALGORITHM_ENTRY_POINT || 'index.js'
};

config.algorithmDiscovery = {
    host: process.env.POD_NAME || '127.0.0.1',
    port: process.env.DISCOVERY_PORT || 9020,
    binary: true
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000',
    binary: !!process.env.STORAGE_BINARY
};

config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage',
    binary: !!process.env.STORAGE_BINARY
};

config.capabilities = {
    storage: 'byRaw,byRef',
    encoding: 'json,bson'
};

config.enableCache = !!process.env.ENABLE_WORKER_CACHE;

config.storageAdapters = {
    s3: {
        connection: config.s3,
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    fs: {
        connection: config.fs,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};
