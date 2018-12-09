const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const fse = require('fs-extra');
const uuid = require('uuid/v4');
const bootstrap = require('../bootstrap');
const builder = require('../lib/builder');

describe('Test', function () {
    before(async () => {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        mockery.registerSubstitute('../algorithm', `${process.cwd()}/tests/mocks/code/nodejs`);
        await bootstrap.init();
    });
    xdescribe('Docker', function () {
        it('should build docker', async function () {
            this.timeout(30000);
            const options = {
                payload: JSON.stringify({
                    name: 'codeless',
                    env: 'nodejs'
                }),
                file: 'uploads/zipped/6976fc4e63d427705650b8c4ab77fd85'
            }
            const result = await builder.build(options);
            expect(result).to.equal();
        });
    });
    describe('Environments', function () {
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
                    metadata: {
                        "mapping": {
                            "init": "module.lib.init4",
                            "start": "module.lib.start",
                            "stop": "module.lib.stop"
                        }
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
