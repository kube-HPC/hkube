
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const monitor = require('@hkube/redis-utils').Monitor;
const component = require('./common/consts/componentNames').MAIN;
let log;

const modules = [
    './lib/monitoring/metrics-provider',
    './lib/state/state-manager',
    './lib/runner/runner'
];

class Bootstrap {
    async init() {
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.info('running application in ' + configIt.env() + ' environment', { component });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            monitor.check(main.redis);
            await Promise.all(modules.map(m => require(m).init(main)));

            return main;
        }
        catch (error) {
            log.error(error);
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
        }
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component }, error);
            log.error(error);
        }
        else {
            console.error(error.message); // eslint-disable-line
            console.error(error); // eslint-disable-line
        }
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info('exit' + (code ? ' code ' + code : ''), { component });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component });
            process.exit(1);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            process.exit(1);
        });
        process.on('unhandledRejection', (error, promise) => {
            log.error('unhandledRejection: ' + error, { component }, error);
            log.error(error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component }, error);
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();

