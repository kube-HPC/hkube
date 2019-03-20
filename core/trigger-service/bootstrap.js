const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { tracer } = require('@hkube/metrics');
const { componentName } = require('./lib/consts/index');
const component = componentName.MAIN;
let log;

const modules = [
    './lib/store/store-manager',
    './lib/queue/trigger-runner',
    './lib/pipelines/stored-pipelines-listener',
    './lib/pipelines/pipeline-producer'
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });

            if (main.tracer) {
                await tracer.init(main.tracer);
            }
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
            log.error(error.message, { component }, error);
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
