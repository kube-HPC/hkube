const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { tracer, metrics } = require('@hkube/metrics');

const component = require('./lib/consts/componentNames').MAIN;
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const modules = [
    require('./lib/db'),
    require('./api/rest-api/app-server'),
    require('./lib/service/dataSource'),
    require('./lib/etcd'),
    require('./lib/jobs-consumer'),
];

class Bootstrap {
    async init() {
        let config = null;
        try {
            this._handleErrors();
            log.info(
                `running application with env: ${configIt.env()}, version: ${
                    main.version
                }, node: ${process.versions.node}`,
                { component }
            );
            await metrics.init(main.metrics);
            if (main.tracer) {
                await tracer.init(main.tracer);
            }
            for (const m of modules) {
                await m.init(main);
            }
            config = main;
        } catch (error) {
            this._onInitFailed(error);
        }
        return config;
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', code => {
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
        process.on('unhandledRejection', error => {
            log.error(
                `unhandledRejection: ${error.message}`,
                { component },
                error
            );
            process.exit(1);
        });
        process.on('uncaughtException', error => {
            log.error(
                `uncaughtException: ${error.message}`,
                { component },
                error
            );
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();
