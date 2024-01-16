
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const Logger = require('@hkube/logger');
let log;
log = new Logger(main.serviceName, logger);
const { tracer, metrics } = require('@hkube/metrics');
const monitor = require('@hkube/redis-utils').Monitor;
const storageManager = require('@hkube/storage-manager');
const component = require('./lib/consts').Components.MAIN;
const worker = require('./lib/worker');
const jobConsumer = require('./lib/consumer/JobConsumer.js');

const modules = [
    require('./lib/metrics/metrics.js'),
    require('./lib/tracing/tracing.js'),
    require('./lib/boards/boards.js'),
    require('./lib/states/stateManager.js'),
    require('./lib/states/stateAdapter.js'),
    require('./lib/algorithm-communication/workerCommunication.js'),
    require('./lib/consumer/JobConsumer.js'),
    require('./lib/producer/producer.js'),
    require('./lib/helpers/kubernetes.js'),
    require('./lib/algorithm-logging/logging-proxy.js'),
    require('./lib/helpers/api-server-client.js'),
    require('./lib/code-api/subpipeline/subpipeline.js'),
    require('./lib/code-api/algorithm-execution/algorithm-execution.js'),
    require('./lib/storage/storage.js'),
    require('./lib/streaming/services/stream-handler.js'),
];
// testing git husky precommit hooks 
class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
                jobConsumer.sendWarning(data.error.message);
                worker.handleExit(1);
            });
            await monitor.check(main.redis);
            await metrics.init(main.metrics);
            await tracer.init(main.tracer);
            await storageManager.init(main, log);

            worker.preInit(main);
            for (const m of modules) {
                await m.init(main, log);
            }
            await worker.init();

            return main;
        }
        catch (error) {
            this._onInitFailed(error);
        }
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
            worker.handleExit(1);
        });
        process.on('uncaughtException', (error) => {
            log.error(`uncaughtException: ${error.message}`, { component }, error);
            worker.handleExit(1);
        });
    }
}

module.exports = new Bootstrap();
