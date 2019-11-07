
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const component = require('./lib/consts/components').MAIN;

const modules = [
    require('./lib/store/store-manager'),
    require('./lib/monitoring/metrics-provider'),
    require('./lib/helpers/prometheus'),
    require('./lib/runner/runner')
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info('running application in ' + configIt.env() + ' environment', { component });
            for (const m of modules) {
                await m.init(main);
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
