process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const monitor = require('@hkube/redis-utils').Monitor;
const componentName = require('./lib/consts/component-name');
const metrics = require('@hkube/metrics');
const {tracer} = require('@hkube/metrics');
const heuristics = require('./lib/heuristic');
const huristicRunner = require('./lib/heuristic-runner');
const queueRunner = require('./lib/queue-runner');
let log;

const modules = [
    'lib/queue-runner'
   
];

class Bootstrap {
    async init() {
        try {
            const { main, logger } = await configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.plugins.use(new VerbosityPlugin(main.redis));
            log.info('running application in ' + configIt.env() + ' environment', { component: componentName.MAIN });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component: componentName.MAIN });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component: componentName.MAIN });
            });
            monitor.check(main.redis);

            await metrics.init(main.metrics);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
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
        process.on('unhandledRejection', (error, promise) => {
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
