const mockery = require('mockery');
const fse = require('fs-extra');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);
const storageManager = require('@hkube/storage-manager');
const stateManger = require('../lib/state/state-manager');
const KubernetesApi = require('../lib/helpers/kubernetes');
const kubernetesServerMock = require('./mocks/kubernetes-server.mock');

const kubeconfig = config.kubernetes.kubeconfig;

const options = {
    kubernetes: {
        kubeconfig
    },
    resources: { defaultQuota: {} },
    healthchecks: { logExternalRequests: false }

};

before(async () => {
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: false
    });
    await fse.mkdirp('/tmp/commands');
    mockery.registerSubstitute('child_process', process.cwd() + '/tests/mocks/child_process.js');
    await KubernetesApi.init(options);
    await kubernetesServerMock.start({ port: 9001 });
    await storageManager.init(config, log, true);
    await stateManger.init(config);
    global.testParams = { config };
});