const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const config = main;
const log = new Logger(config.serviceName, logger);
const component = require('./lib/consts/components').MAIN;
const dockerBuild = require('./lib/builds/docker-builder');

const modules = [
    require('@hkube/storage-manager'),
    require('./lib/state/state-manager')
];

class Bootstrap {
    async init() {
        try {
            this._handleErrors();
            log.info(`running application with env: ${configIt.env()}, version: ${config.version}, node: ${process.versions.node}`, { component });
            await Promise.all(modules.map(m => m.init(config)));
            await this._initTestMode(config);
            const response = await dockerBuild(config);
            console.log(response.result.output.data);
            console.log(response.result.output.error);
            const code = response.error ? 1 : 0;
            process.exit(code);
        }
        catch (error) {
            this._onInitFailed(error);
        }
    }

    async _initTestMode(config) {
        if (config.testMode) {
            const mockZip = `${process.cwd()}/tests/mocks/nodejs/sort-alg-nodejs.tar.gz`;
            const mockBuildNodejs = require('./tests/mocks/nodejs/build.json');
            const stateManger = require('./lib/state/state-manager');
            const storageManager = require('@hkube/storage-manager');
            const fse = require('fs-extra');
            const { buildId } = mockBuildNodejs;
            await stateManger.insertBuild(mockBuildNodejs);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(mockZip) });
            config.buildId = buildId;
        }
    }

    _onInitFailed(error) {
        log.error(error.message, { component }, error);
        log.error(error);
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
