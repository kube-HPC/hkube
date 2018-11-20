
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const storageManager = require('@hkube/storage-manager')
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { VerbosityPlugin } = Logger;
log.plugins.use(new VerbosityPlugin(main.redis));
const { componentName } = require('./lib/consts/index');

const modules = [
    './lib/api/rest',
    './lib/runner'

];


class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            storageManager.init(main);
            log.info('running application in ' + configIt.env() + ' environment', { component: componentName.MAIN });
            await Promise.all(modules.map(m => require(m).init(main)));// eslint-disable-line global-require, import/no-dynamic-require
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
