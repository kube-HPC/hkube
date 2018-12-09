const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const request = require('request-promise');
const fse = require('fs-extra');
const uuid = require('uuid/v4');
const bootstrap = require('../bootstrap');
const builder = require('../lib/builder');


const postFile = async ({ uri, formData }) => {
    const result = await request({
        method: 'POST',
        uri,
        formData
    });
    return result;
}

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
    describe('Docker', function () {
        it('should build docker', async function () {
            this.timeout(30000);
            const body = {
                name: 'codeless',
                env: 'nodejs'
            }
            const file = `${process.cwd()}/tests/mocks/zipped/a63d8da3237ed7a2232bc61ca4cd2d81`;
            const formData = {
                payload: JSON.stringify(body),
                code: fse.createReadStream(file)
            };
            const result = await postFile({
                uri: 'http://localhost:3003/api/algorithms/create',
                formData
            });
            expect(result).to.be.a('function');
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
                            "init": "module.lib.init",
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
