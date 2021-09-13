
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { tracer } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const monitor = require('@hkube/redis-utils').Monitor;
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);
const component = require('./lib/consts/component-name').MAIN;
const gracefulShutdown = require('./lib/graceful-shutdown');

const modules = [
    require('./lib/persistency/db'),
    require('./lib/persistency/etcd'),
    require('./lib/queues-manager'),
    require('./lib/metrics/aggregation-metrics-factory')
];

class Bootstrap {
    async init(bootstrap) {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            await monitor.check(config.redis);
            if (config.tracer) {
                await tracer.init(config.tracer);
            }
            await storageManager.init(config, log, bootstrap);
            for (const m of modules) {
                await m.init(config);
            }
            return config;
        }
        catch (error) {
            this._onInitFailed(error);
            return null;
        }
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info(`exit code ${code}`, { component });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component });
            gracefulShutdown.shutdown(() => {
                process.exit(0);
            });
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            gracefulShutdown.shutdown(() => {
                process.exit(0);
            });
        });
        process.on('unhandledRejection', (error) => {
            log.error(`unhandledRejection: ${error.message}`, { component }, error);
            gracefulShutdown.shutdown(() => {
                process.exit(1);
            });
        });
        process.on('uncaughtException', (error) => {
            log.error(`uncaughtException: ${error.message}`, { component }, error);
            gracefulShutdown.shutdown(() => {
                process.exit(1);
            });
        });
    }
}

module.exports = new Bootstrap();