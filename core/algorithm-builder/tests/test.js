const { expect } = require('chai');
const fse = require('fs-extra');
const { uuid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const stateManger = require('../lib/state/state-manager');
const mockBuildNodejs = require('./mocks/nodejs/build.json');
const mockBuildNodejsFromGit = require('./mocks/nodejs/build-from-git');
const mockBuildPython = require('./mocks/python/build.json');
let config, dockerBuilder;

describe('Test', function () {
    before(async () => {
        config = global.testParams.config;
        dockerBuilder = require('../lib/builds/docker-builder');
    });
    describe('Docker', function () {
        it('should failed to build docker when no build id', async function () {
            const response = await dockerBuilder.runBuild(config);
            expect(response.error).to.equal('build id is required');
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        it('should failed to build docker when no such build id', async function () {
            config.buildId = `no_such_build-${uuid()}`;
            const response = await dockerBuilder.runBuild(config);
            expect(response.error).to.equal(`unable to find build -> ${config.buildId}`);
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        it('should build', async function () {
            const mockBuild = require(`./mocks/python/build.json`);

            await stateManger.insertBuild(mockBuild);
            await stateManger.updateBuild(mockBuild);
        });
        xit('should succeed to build docker', async function () {
            this.timeout(5000)
            const env = config.testModeEnv;
            const tar = `${process.cwd()}/tests/mocks/${env}/alg.tar.gz`;
            const mockBuild = require(`./mocks/${env}/build.json`);
            const mockAlg = require(`./mocks/${env}/algorithm.json`);

            const { buildId } = mockBuild;
            await stateManger._etcd.algorithms.store.set(mockAlg);
            await stateManger.insertBuild(mockBuild);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(tar) });
            config.buildId = buildId;

            await dockerBuilder.runBuild(config);
            const build = await stateManger.watchBuild({ buildId });
            expect(build.algorithmImage).to.contain(mockBuild.algorithmName);
            expect(build.algorithmImage).to.contain(mockBuild.version);
        });
        xit('NODEJS: should succeed to build docker', async function () {
            this.timeout(50000);
            const mockZip = `${process.cwd()}/tests/mocks/nodejs/sort-alg-nodejs.tar.gz`;
            const { buildId } = mockBuildNodejs;
            await stateManger.insertBuild(mockBuildNodejs);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(mockZip) });
            config.buildId = buildId;
            const response = await dockerBuilder.runBuild(config);
            expect(response.status).to.equal('completed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        xit('NODEJS: should succeed to build docker from git', async function () {
            this.timeout(5000000);
            const { buildId } = mockBuildNodejsFromGit;
            await stateManger.insertBuild(mockBuildNodejsFromGit);
            config.buildId = buildId;
            const response = await dockerBuilder.runBuild(config);
            expect(response.status).to.equal('completed');
            expect(response).to.have.property('buildId');
            expect(response.result).to.contain('docker version')
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        xit('PYTHON: should succeed to build docker', async function () {
            this.timeout(200000);
            const mockZip = `${process.cwd()}/tests/mocks/python/web-scrap.tar.gz`;
            const { buildId } = mockBuildPython;
            await stateManger.insertBuild(mockBuildPython);
            await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(mockZip) });
            config.buildId = buildId;
            const response = await dockerBuilder.runBuild(config);
            expect(response.status).to.equal('completed');
            expect(response).to.have.property('buildId');
            expect(response.result).to.contain('docker version')
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
    });
});
