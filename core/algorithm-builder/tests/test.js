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
        await bootstrap.init();
    });
    xdescribe('Docker', function () {
        it('should build docker', async function () {
            this.timeout(30000);
            const payload = {
                name: 'codeless',
                env: 'nodejs'
            }
            const file = `${process.cwd()}/tests/mocks/zipped/a63d8da3237ed7a2232bc61ca4cd2d81`;
            await builder.build({ payload: JSON.stringify(payload), file });
            expect(true).to.be.a('boolean');
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
