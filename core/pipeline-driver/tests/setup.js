
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const { Factory } = require('@hkube/redis-utils');
const bootstrap = require('../bootstrap');
const StateManager = require('../lib/state/state-manager');
const { main: config, logger } = configIt.load();
let log = new Logger(config.serviceName, logger);

before(async () => {
    await storageManager.init(config, log, true);
    await bootstrap.init();
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    const stateManager = new StateManager(config);
    await stateManager._etcd._client.client.delete().all()

    global.testParams = {
        config
    }
});
