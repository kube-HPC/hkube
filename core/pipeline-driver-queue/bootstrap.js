const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const monitor = require('@hkube/redis-utils').Monitor;
const { component } = require('./lib/consts').componentName.MAIN;
const { tracer } = require('@hkube/metrics');

const modules = [
    './lib/jobs/consumer',
    './lib/jobs/producer-singleton',
    './lib/jobs/producer',
    './lib/queue-runner',
    './lib/metrics/aggregation-metrics-factory'
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info('running application in ' + configIt.env() + ' environment', { component });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            monitor.check(main.redis);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            await Promise.all(modules.map(m => require(m).init(main))); // eslint-disable-line
        }
        catch (error) {
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
        }
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        log.error(error);
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
        process.on('unhandledRejection', (error) => {
            log.error('unhandledRejection: ' + error, { component }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component }, error);
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
