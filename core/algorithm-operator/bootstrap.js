const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { rest: healthcheck } = require('@hkube/healthchecks');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const component = require('./lib/consts/componentNames').MAIN;
const db = require('./lib/helpers/db');
const etcd = require('./lib/helpers/etcd');
const kubernetes = require('./lib/helpers/kubernetes');
const operator = require('./lib/operator');
const jobProducer = require('./lib/producer/jobs-producer');
const { setFromConfig } = require('./lib/helpers/settings');

const modules = [
    db,
    etcd,
    kubernetes,
    jobProducer,
    operator
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });
            setFromConfig(main);
            await Promise.all(modules.map(m => m.init(main)));
            await healthcheck.init({ port: main.healthchecks.port });
            healthcheck.start(main.healthchecks.path, () => operator.checkHealth(main.healthchecks.maxDiff), 'health');
        }
        catch (error) {
            this._onInitFailed(error);
        }
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
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
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
