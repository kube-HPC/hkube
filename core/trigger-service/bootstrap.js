const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const monitor = require('@hkube/redis-utils').Monitor;
const { componentName } = require('./lib/consts/index');
const { tracer } = require('@hkube/metrics');
let log;

const modules = [
    './lib/store/store-manager',
    './lib/queue/trigger-runner',
    './lib/pipelines/stored-pipelines-listener',
    './lib/pipelines/pipeline-producer',
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
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
            await Promise.all(modules.map(m => require(m).init(main)));// eslint-disable-line global-require, import/no-dynamic-require

            config = main;
        }
        catch (error) {
            log.error(error);
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
        }
        return config;
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component: componentName.MAIN }, error);
            log.error(error);
        }
        else {
            console.error(error.message);// eslint-disable-line 
            console.error(error);// eslint-disable-line
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
        process.on('unhandledRejection', (error) => {
            log.error('unhandledRejection: ' + error, { component: componentName.MAIN }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component: componentName.MAIN }, error);
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
