
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const { rest: healthcheck } = require('@hkube/healthchecks');
const log = new Logger(main.serviceName, logger);
const component = require('./lib/consts/components').MAIN;
const storeManager = require('./lib/store/store-manager');
const metricsProvider = require('./lib/monitoring/metrics-provider');
const prometheus = require('./lib/helpers/prometheus');
const runner = require('./lib/runner/runner');
const modules = [
    storeManager,
    metricsProvider,
    prometheus,
    runner,
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info('running application in ' + configIt.env() + ' environment', { component });
            for (const m of modules) {
                await m.init(main);
            }
            if (main.healthchecks.enabled) {
                await healthcheck.init({ port: main.healthchecks.port });
                healthcheck.start(main.healthchecks.path, () => runner.checkHealth(main.healthchecks.maxDiff), main.serviceName);
            }
        }
        catch (error) {
            this._onInitFailed(error);
        }
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info(`exit with code ${code}`, { component });
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
            log.error(`Unhandled Rejection: ${error.message}`, { component }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error(`Uncaught Exception: ${error.message}`, { component }, error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
