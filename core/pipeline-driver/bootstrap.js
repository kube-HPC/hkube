
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const monitor = require('@hkube/redis-utils').Monitor;
const { tracer, metrics } = require('@hkube/metrics');
const component = require('./lib/consts/componentNames').MAIN;
const storageManager = require('@hkube/storage-manager');
let log;

const modules = [
    require('./lib/state/db'),
    require('./lib/producer/jobs-producer'),
    require('./lib/consumer/jobs-consumer'),
    require('./lib/metrics/pipeline-metrics'),
    require('./lib/datastore/graph-store')
];

class Bootstrap {
    async init() {
        try {
            const { main, logger } = configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.info(`running application with env: ${configIt.env()}, version: ${main.version}, node: ${process.versions.node}`, { component });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            monitor.check(main.redis);
            await metrics.init(main.metrics);
            await storageManager.init(main, log);

            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            await Promise.all(modules.map(m => m.init(main)));
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
            if (error.isBrokenCircuitError) {
                log.warning(`ignored unhandledRejection: ${error.message}`, { component }, error);
                return;
            }
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
