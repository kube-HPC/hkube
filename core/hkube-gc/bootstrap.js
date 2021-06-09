const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const { rest: healthchecks } = require('@hkube/healthchecks');
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);
const component = require('./lib/consts/componentNames').MAIN;
const etcd = require('./lib/helpers/etcd');
const redis = require('./lib/helpers/redis');
const kubernetes = require('./lib/helpers/kubernetes');
const storeManager = require('./lib/helpers/store-manager');
const cleanerManager = require('./lib/core/cleaner-manager');
const appServer = require('./api/rest-api/app-server');

const modules = [
    etcd,
    redis,
    kubernetes,
    storeManager,
    storageManager,
    appServer
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            await cleanerManager.init(config);
            await Promise.all(modules.map(m => m.init(config)));
            await healthchecks.initAndStart(config.healthchecks, () => cleanerManager.checkHealth(config.healthchecks.maxDiff), config.serviceName);
        }
        catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        log.error(error, { component }, error);
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info(`exit code ${code}`, { component });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component });
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            process.exit(0);
        });
        process.on('unhandledRejection', (error) => {
            log.error(`unhandledRejection: ${error.message}`, { component }, error);
            process.exit(1);
        });
        process.on('uncaughtException', (error) => {
            log.error(`uncaughtException: ${error.message}`, { component }, error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
