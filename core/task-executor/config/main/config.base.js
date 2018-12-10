const config = {};

config.serviceName = 'task-executor';

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default'
};

config.etcd = {
    etcd: {
        protocol: 'http',
        host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
        port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
    },
    serviceName: config.serviceName
};

config.driversSetting = {
    name: 'pipeline-driver',
    minAmount: parseInt(process.env.PIPELINE_DRIVERS_AMOUNT || 30, 10),
    scalePercent: parseFloat(process.env.PIPELINE_DRIVERS_SCALE_PERCENT || 0.2, 10)
};

config.intervalMs = process.env.INTERVAL_MS || '3000';
config.createdJobsTTL = process.env.CREATED_JOBS_TTL || 15 * 1000;

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};

config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';

config.tracer = {
    tracerConfig: {
        serviceName: config.serviceName,
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
        }
    }
};

module.exports = config;
