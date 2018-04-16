process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const {VerbosityPlugin} = Logger;
log.plugins.use(new VerbosityPlugin(main.redis));
const monitor = require('@hkube/redis-utils').Monitor;
const {componentName} = require('./lib/consts/index');
// const metrics = require('@hkube/metrics');
// const consumer = require('./lib/jobs/consumer');
const {tracer} = require('@hkube/metrics');
const modules = [
    './lib/stored-pipelines-listener',
    './lib/trigger-runner',
    './lib/pipeline-producer',
    
    // './lib/jobs/consumer',
    // './lib/jobs/producer',
    // './lib/queue-runner',
    // './lib/metrics/aggregation-metrics-factory'
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
            //   await metrics.init(main.metrics);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            //       consumer.init(main);
            await Promise.all(modules.map(m => require(m).init(main)));// eslint-disable-line global-require, import/no-dynamic-require
            
            return main;
        }
        catch (error) {
            log.error(error);
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
        }
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
