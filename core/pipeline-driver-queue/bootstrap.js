const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);
const monitor = require('@hkube/redis-utils').Monitor;
const component = require('./lib/consts').componentName.MAIN;
const { tracer } = require('@hkube/metrics');
const gracefulShutdown = require('./lib/graceful-shutdown');


const modules = [
    require('./lib/persistency/data-store'),
    require('./lib/metrics/aggregation-metrics-factory'),
    require('./lib/jobs/producer'),
    require('./lib/queue-runner'),
    require('./lib/jobs/consumer'),
    require('./api/rest-api/app-server')
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
                this._gracefulShutdown(1);
            });
            await monitor.check(config.redis);
            if (config.tracer) {
                await tracer.init(config.tracer);
            }
            for (const m of modules) {
                await m.init(config);
            }
        }
        catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        process.exit(1);
    }

    _gracefulShutdown(code) {
        gracefulShutdown.shutdown(() => {
            process.exit(code);
        });
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info(`exit code ${code}`, { component });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component });
            this._gracefulShutdown(0);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            this._gracefulShutdown(0);
        });
        process.on('unhandledRejection', (error) => {
            console.error(error)
            log.error(`unhandledRejection: ${error.message}`, { component }, error);
            this._gracefulShutdown(1);
        });
        process.on('uncaughtException', (error) => {
            log.error(`uncaughtException: ${error.message}`, { component }, error);
            this._gracefulShutdown(1);
        });
    }
}

module.exports = new Bootstrap();
