const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const config = main;
const log = new Logger(main.serviceName, logger);
const dockerBuild = require('../lib/builds/docker-builder');

describe('Test', function () {
    before(async () => {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
    });
    describe('Docker', function () {
        it('should build docker', async function () {
            this.timeout(30000);
            const payload = {
                version: '1.0.0',
                algorithm: {
                    name: 'codeless',
                    env: 'nodejs',
                    code: {
                        fileExt: '.gz'
                    }
                }
            }
            const src = `${process.cwd()}/tests/mocks/zipped/sort-alg.tar.gz`;
            const response = await dockerBuild({ payload, src, docker: config.docker, deleteSrc: false });

            console.log('------------RESULT-----------------');
            console.log(response.resultData);
            console.log('------------RESULT-----------------');

            console.log('-----------------------------------');

            console.log('------------ERROR-----------------');
            console.error(response.errorMsg);
            console.log('------------ERROR-----------------');

            expect(response).to.have.property('errorMsg');
            expect(response).to.have.property('resultData');
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
