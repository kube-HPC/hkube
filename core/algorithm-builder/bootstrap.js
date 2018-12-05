const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const component = require('./lib/consts/componentNames').MAIN;
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const modules = [
    require('./api/rest-api/app-server')
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            this._handleErrors();
            log.info('running application in ' + configIt.env() + ' environment', { component });

            await storageManager.init(main, true);

            await Promise.all(modules.map(m => m.init(main)));
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
            log.info(`exit code ${code}`, { component });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component });
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component });
            process.exit(0);
        });
        process.on('unhandledRejection', (error) => {
            log.error(`unhandledRejection: ${error.message}`, { component }, error);
            process.exit(1);
        });
        process.on('uncaughtException', (error) => {
            log.error(`uncaughtException: ${error.message}`, { component }, error);
            log.error(error);
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
