
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { VerbosityPlugin } = Logger;
log.plugins.use(new VerbosityPlugin(main.redis));
const monitor = require('@hkube/redis-utils').Monitor;
const { componentName } = require('./lib/consts/index');
const { tracer } = require('@hkube/metrics');

const modules = [
    require('./lib/jobs/consumer'),
    require('./lib/jobs/producer-singleton'),
    require('./lib/jobs/producer'),
    require('./lib/queue-runner'),
    require('./lib/metrics/aggregation-metrics-factory')
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info('running application in ' + configIt.env() + ' environment', { component: componentName.MAIN });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component: componentName.MAIN });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component: componentName.MAIN });
            });
            monitor.check(main.redis);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            await Promise.all(modules.map(m => m.init(main)));

            return main;
        }
        catch (error) {
            log.error(error);
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
            return null;
        }
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component: componentName.MAIN }, error);
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
            log.info('exit' + (code ? ' code ' + code : ''), { component: componentName.MAIN });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component: componentName.MAIN });
            process.exit(1);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component: componentName.MAIN });
            process.exit(1);
        });
        process.on('unhandledRejection', (error, reason) => {
            log.error('unhandledRejection: ' + error, { component: componentName.MAIN }, error);
            log.error('unhandledRejection:reson ' + JSON.stringify(reason), { component: componentName.MAIN }, reason);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component: componentName.MAIN }, error);
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
