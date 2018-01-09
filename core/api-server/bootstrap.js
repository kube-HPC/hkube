const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { VerbosityPlugin } = require('@hkube/logger');
const monitor = require('@hkube/redis-utils').Monitor;
const componentNames = require('./common/consts/componentNames.js');
const metrics = require('@hkube/metrics');
const { tracer } = require('@hkube/metrics');
let log;

const modules = [
    './lib/state/state-manager',
    './lib/producer/jobs-producer',
    './lib/webhook/webhooks-handler',
    './lib/examples/pipelines-updater'
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.plugins.use(new VerbosityPlugin(main.redis));
            log.info('running application in ' + configIt.env() + ' environment', { component: componentNames.MAIN });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component: componentNames.MAIN });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component: componentNames.MAIN });
            });
            monitor.check(main.redis);

            await metrics.init(main.metrics);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            const appServer = require('./api/rest-api/app-server');
            const dataRest = await appServer.init(main);
            log.info(dataRest.message, { component: componentNames.REST_API });

            await Promise.all(modules.map(m => require(m).init(main)));

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
            log.error(error.message, { component: componentNames.MAIN }, error);
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
            log.info('exit' + (code ? ' code ' + code : ''), { component: componentNames.MAIN });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component: componentNames.MAIN });
            process.exit(1);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component: componentNames.MAIN });
            process.exit(1);
        });
        process.on('unhandledRejection', (error) => {
            log.error('unhandledRejection: ' + error.message, { component: componentNames.MAIN }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component: componentNames.MAIN }, error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();

