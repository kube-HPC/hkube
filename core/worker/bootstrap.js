
process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const configIt = require('config.rf');
const Logger = require('logger.rf');
const VerbosityPlugin = require('logger.rf').VerbosityPlugin;
const monitor = require('redis-utils.rf').Monitor;
const componentName = require('common/consts/componentNames');
let log;

const modules = [
    'lib/algorunnerCommunication/workerCommunication.js',
    'lib/consumer/JobConsumer.js',
    'lib/states/discovery.js',
    'lib/states/stateManager.js'
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
            await monitor.check(main.redis);
6
            await Promise.all(modules.map(m => require(m).init(main)));

            return main;
        }
        catch (error) {
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
        process.on('unhandledRejection', (error) => {
            log.error('unhandledRejection: ' + error.message, { component: componentName.MAIN }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component: componentName.MAIN }, error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();

