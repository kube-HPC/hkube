const { expect } = require('chai');
const fse = require('fs-extra');
const { uuid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const stateManger = require('../lib/state/state-manager');
const { createBuild } = require('./builds');
let config, dockerBuilder;

const runBuild = async ({ buildId, env }) => {
    const tar = `${process.cwd()}/tests/mocks/${env}/alg.tar.gz`;
    const file = await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(tar) });
    const buildObj = createBuild({ buildId, env, filePath: file.path });
    await stateManger.insertBuild(buildObj);
    await dockerBuilder.runBuild({ ...config, buildId });
}

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
        it('java: build', async function () {
            const env = 'java';
            const buildId = uuid();
            await runBuild({ buildId, env });
            const build = await stateManger.getBuild({ buildId });
            expect(build.status).to.equal('completed');
            expect(build.algorithmImage).to.equal('docker.io/sort-alg:v5.0.0');
            expect(build.progress).to.equal(100);
        });
        it('nodejs: build', async function () {
            this.timeout(20000)
            const env = 'nodejs';
            const buildId = uuid();
            await runBuild({ buildId, env });
            const build = await stateManger.getBuild({ buildId });
            expect(build.status).to.equal('completed');
            expect(build.algorithmImage).to.equal('docker.io/sort-alg:v5.0.0');
            expect(build.progress).to.equal(100);
        });
        it('python: build', async function () {
            const env = 'python';
            const buildId = uuid();
            await runBuild({ buildId, env });
            const build = await stateManger.getBuild({ buildId });
            expect(build.status).to.equal('completed');
            expect(build.algorithmImage).to.equal('docker.io/sort-alg:v5.0.0');
            expect(build.progress).to.equal(100);
        });
    });
});
