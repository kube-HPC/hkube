const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { tracer, metrics } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const monitor = require('@hkube/redis-utils').Monitor;
const component = require('./lib/consts/componentNames').MAIN;
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const modules = [
    require('./api/rest-api/app-server'),
    require('./lib/state/state-manager'),
    require('./lib/producer/jobs-producer'),
    require('./lib/examples/pipelines-updater'),
    require('./lib/webhook/webhooks-handler')
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            this._handleErrors();
            log.info(`running application in ${configIt.env()} environment`, { component });
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
            await Promise.all(modules.map(m => m.init(main)));
            config = main;
        }
        catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component }, error);
            log.error(error);
        }
        else {
            console.error(error.message);
            console.error(error);
        }
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
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
