const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { tracer, metrics } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const monitor = require('@hkube/redis-utils').Monitor;
const component = require('./lib/consts/componentNames').MAIN;
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const modules = [
    require('./lib/db'),
    require('./api/rest-api/app-server'),
    require('./lib/state/state-manager'),
    require('./lib/producer/jobs-producer'),
    require('./lib/examples/pipelines-updater'),
    require('./lib/webhook/webhooks-handler'),
    require('./lib/service/graph'),
    require('./lib/service/builds'),
    require('./lib/service/algorithms'),
    require('./lib/service/caching'),
    require('./lib/service/storage'),
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            await monitor.check(main.redis);
            await metrics.init(main.metrics);
            await storageManager.init(main, log, true);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            for (const m of modules) {
                await m.init(main);
            }
            config = main;
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
