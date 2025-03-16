const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { tracer, metrics } = require('@hkube/metrics');
const { rest: healthcheck } = require('@hkube/healthchecks');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('./lib/state/state-manager');
const monitor = require('@hkube/redis-utils').Monitor;
const component = require('./lib/consts/componentNames').MAIN;
const { main: config, logger } = configIt.load();
const log = new Logger(config.serviceName, logger);

const modules = [
    require('./lib/state/state-manager'),
    require('./lib/producer/jobs-producer'),
    require('./lib/webhook/webhooks-handler'),
    require('./lib/service/graph'),
    require('./lib/service/builds'),
    require('./lib/service/algorithms'),
    require('./lib/service/data-sources'),
    require('./lib/service/storage'),
    require('./lib/service/gateway'),
    require('./lib/service/debug'),
    require('./lib/service/auth'),
    require('./lib/service/keycloak'),
    require('./api/graphql/queries/database-querier'),
    require('./api/graphql/queries/prefered-querier'),
    require('./api/graphql/queries/dataSource-querier'),
    require('./api/graphql/queries/statistics-querier'),
    require('./api/graphql/queries/error-logs-querier'),
    require('./api/task-logs/logs'),
    require('./lib/service/output'),
    require('./lib/service/hyperparams-tuner'),
    require('./api/app-server'),
    require('./lib/examples/pipelines-updater')
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            monitor.on('ready', (data) => {
                log.info((data.message).green, { component });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component });
            });
            await monitor.check(config.redis);
            await metrics.init(config.metrics);
            await storageManager.init(config, log, true);
            if (config.tracer) {
                await tracer.init(config.tracer);
            }
            for (const m of modules) {
                await m.init(config);
            }
            if (config.healthchecks.enabled) {
                await healthcheck.init({ port: config.healthchecks.port });
                healthcheck.start(config.healthchecks.path, () => stateManager.checkHealth(config.healthchecks.maxFailed), 'health');
            }
        }
        catch (error) {
            this._onInitFailed(error);
        }
        return config;
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
