const config = {};
config.driversSetting = {
    minAmount: 20,
    scalePercent: 0.2
};
config.intervalMs = process.env.INTERVAL_MS || 15000;

const kubeconfig = {
    apiVersion: 'v1',
    kind: 'Config',
    'current-context': 'test',
    clusters: [{
        name: 'test',
        cluster: {
            server: "http://127.0.0.1:9001/"
        }
    }],
    contexts: [{
        name: 'test',
        context: {
            cluster: 'test',
            user: 'test-admin'
        }
    }],
    users: [{
        name: 'default-admin',
        user: {}
    }]
}

config.kubernetes = {
    kubeconfig
};
config.healthchecks = {
    enabled: false
}
config.cacheResults = {
    enabled: false
}
module.exports = config;
