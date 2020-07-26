
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const bootstrap = require('../bootstrap');
const { main: config, logger } = configIt.load();
let log = new Logger(config.serviceName, logger);

before(async () => {
    await storageManager.init(config, log, true);
    await bootstrap.init();

    global.testParams = {
        config
    }
});
