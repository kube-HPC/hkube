const { expect } = require('chai');
const sinon = require('sinon');
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
const mockBuild = require('./mocks/build.json');
const mockZip = `${process.cwd()}/tests/mocks/zipped/sort-alg`;

describe('Test', function () {
    before(async () => {
        await storageManager.init(main, true);
        await stateManger.init(main);
    });
    describe('Docker', function () {
        it('should failed to build docker when no build id', async function () {
            const response = await dockerBuild(config);
            expect(response.error).to.equal('build id is required');
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        it('should failed to build docker when no such build id', async function () {
            config.buildId = `no_such_build-${uuid()}`;
            const response = await dockerBuild(config);
            expect(response.error).to.equal(`unable to find build -> ${config.buildId}`);
            expect(response.status).to.equal('failed');
            expect(response).to.have.property('buildId');
            expect(response).to.have.property('error');
            expect(response).to.have.property('status');
            expect(response).to.have.property('result');
        });
        it('should succeed to build docker', async function () {
            this.timeout(50000);
            const { buildId } = mockBuild;
            await stateManger.setBuild(mockBuild);
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
    xdescribe('Environments', function () {
        describe('Nodejs', function () {
            it('should build docker', async function () {
                this.timeout(30000);
                const payload = {
                    name: 'codeless',
                    env: 'nodejs'
                };
                const config = {
                    adapter: 'socket',
                    socket: {
                        port: 9876,
                        host: 'localhost',
                        protocol: 'ws'
                    },
                    algorithmPath: `${process.cwd()}/tests/mocks/code/nodejs`,
                    algorithmData: {
                        entryPoint: 'lib/algorithm.js'
                    }
                };

                const env = `${process.cwd()}/environments/${payload.env}`;
                const algorithm = require(`${env}/lib/algorunner.js`);
                await algorithm.init(config);
                expect(algorithm._algorithm.init).to.be.a('function');
                expect(algorithm._algorithm.start).to.be.a('function');
                expect(algorithm._algorithm.stop).to.be.a('function');
            });
        });
    });
});
