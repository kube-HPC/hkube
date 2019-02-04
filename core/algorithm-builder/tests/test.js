const { expect } = require('chai');
const fse = require('fs-extra');
const uuid = require('uuid');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const config = main;
const log = new Logger(main.serviceName, logger);
const dockerBuild = require('../lib/builds/docker-builder');
const storageManager = require('@hkube/storage-manager');
const stateManger = require('../lib/state/state-manager');
const mockBuildNodejs = require('./mocks/nodejs/build.json');
const mockBuildPython = require('./mocks/python/build.json');

describe('Test', function () {
    before(async () => {
        await storageManager.init(main, true);
        await stateManger.init(main);
    });
    describe('Docker', function () {
        xit('should failed to build docker when no build id', async function () {
            const response = await dockerBuild(config);
            expect(response.error).to.equal('build id is required');
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        xit('should failed to build docker when no such build id', async function () {
            config.buildId = `no_such_build-${uuid()}`;
            const response = await dockerBuild(config);
            expect(response.error).to.equal(`unable to find build -> ${config.buildId}`);
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        xit('NODEJS: should succeed to build docker', async function () {
            this.timeout(50000);
            const mockZip = `${process.cwd()}/tests/mocks/nodejs/sort-alg-nodejs.tar.gz`;
            const { buildId } = mockBuildNodejs;
            await stateManger.setBuild(mockBuildNodejs);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(mockZip) });
            config.buildId = buildId;
            const response = await dockerBuild(config);
            expect(response.status).to.equal('completed');
            expect(response).to.have.property('buildId');
            expect(response.result).to.contain('docker version')
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        it('PYTHON: should succeed to build docker', async function () {
            this.timeout(200000);
            const mockZip = `${process.cwd()}/tests/mocks/python/web-scrap.tar.gz`;
            const { buildId } = mockBuildPython;
            await stateManger.setBuild(mockBuildPython);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(mockZip) });
            config.buildId = buildId;
            const response = await dockerBuild(config);
            expect(response.status).to.equal('completed');
            expect(response).to.have.property('buildId');
            expect(response.result).to.contain('docker version')
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
    });
});
