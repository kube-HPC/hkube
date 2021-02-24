const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { tracer, metrics } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const component = require('./lib/consts/componentNames').MAIN;
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);
const dedicatedStorage = require('./lib/DedicatedStorage');
const gitToken = require('./lib/service/gitToken');

const modules = [
    require('./lib/db'),
    require('./lib/service/gitToken'),
    require('./api/rest-api/app-server'),
    require('./lib/service/dataSource'),
    require('./lib/service/snapshots'),
    require('./lib/service/downloads'),
    require('./lib/service/validation'),
    require('./lib/service/jobs-consumer'),
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(
                `running application with env: ${configIt.env()}, version: ${
                    config.version
                }, node: ${process.versions.node}`,
                { component }
            );
            await metrics.init(config.metrics);
            if (config.tracer) {
                await tracer.init(config.tracer);
            }

            await dedicatedStorage.init(
                { ...config, defaultStorage: config.dvcStorage },
                log,
                true,
                [storageManager.STORAGE_PREFIX.STORAGE_PREFIX.HKUBE_DATASOURCE]
            );
            await storageManager.init(config, log);

            for (const m of modules) {
                await m.init(config);
            }
        } catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', code => {
            log.info(`exit code ${code}`, { component });
        });
        process.on('SIGINT', async () => {
            log.info('SIGINT', { component });
            await gitToken.removeStoredToken();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            process.exit(0);
        });
        process.on('unhandledRejection', error => {
            log.error(
                `unhandledRejection: ${error.message}`,
                { component },
                error
            );
            process.exit(1);
        });
        process.on('uncaughtException', error => {
            log.error(
                `uncaughtException: ${error.message}`,
                { component },
                error
            );
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
