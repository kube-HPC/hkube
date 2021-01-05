const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const config = main;
const log = new Logger(config.serviceName, logger);
const component = require('./lib/consts/components').MAIN;
const dockerBuilder = require('./lib/builds/docker-builder');
const kubernetes = require('./lib/helpers/kubernetes');

const modules = [
    require('@hkube/storage-manager'),
    require('./lib/state/state-manager'),
    kubernetes
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            await Promise.all(modules.map(m => m.init(config)));
            await this._initTestMode(config);
            const response = await dockerBuilder.runBuild(config);
            console.log(response.result.data || 'No Data');
            console.log(response.result.warning || 'No Warnings');
            console.log(response.result.errors || 'No Errors');
            const code = response.error ? 1 : 0;
            process.exit(code);
        }
        catch (error) {
            this._onInitFailed(error);
        }
    }

    async _initTestMode(config) {
        if (config.testMode) {
            const env = config.testModeEnv;
            const tar = `${process.cwd()}/tests/mocks/${env}/alg.tar.gz`;
            const mockBuild = require(`./tests/mocks/${env}/build.json`);
            const stateManger = require('./lib/state/state-manager');
            const storageManager = require('@hkube/storage-manager');
            const fse = require('fs-extra');
            const { buildId } = mockBuild;
            const {path: filePath} = await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(tar) });
            await stateManger.insertBuild({...mockBuild, filePath});
            config.buildId = buildId;
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
