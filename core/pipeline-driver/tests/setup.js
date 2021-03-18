
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const bootstrap = require('../bootstrap');
const db = require('../lib/state/db');
const StateManager = require('../lib/state/state-manager');
const { main: config, logger } = configIt.load();
let log = new Logger(config.serviceName, logger);

before(async () => {
    await storageManager.init(config, log, true);
    await bootstrap.init();
    const stateManager = new StateManager(config);
    await stateManager._etcd._client.client.delete().all()
    global.testParams = {
        config
    }
});
