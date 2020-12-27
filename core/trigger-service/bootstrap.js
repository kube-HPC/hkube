const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { componentName } = require('./lib/consts');
const component = componentName.MAIN;
let log;

const modules = [
    require('./lib/store/store-manager'),
    require('./lib/queue/trigger-runner'),
    require('./lib/pipelines/pipeline-producer')
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });

            for (const m of modules) {
                await m.init(main);
            }

            config = main;
        }
        catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component }, error);
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
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
