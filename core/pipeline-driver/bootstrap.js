
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const monitor = require('@hkube/redis-utils').Monitor;
const { tracer, metrics } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const component = require('./lib/consts/componentNames').MAIN;
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const modules = [
    require('./lib/state/state-manager'),
    require('./lib/producer/jobs-producer'),
    require('./lib/consumer/jobs-consumer'),
    require('./lib/metrics/pipeline-metrics')
];

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
                process.exit(1);
            });
            monitor.check(main.redis);
            await metrics.init(main.metrics);
            await storageManager.init(main, log);

            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            await Promise.all(modules.map(m => m.init(main)));
            log.info(`driver has started with concurrency limit of ${main.jobs.consumer.concurrency} jobs`, { component });
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
