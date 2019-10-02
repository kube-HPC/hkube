const { expect } = require('chai');
const fse = require('fs-extra');
const uuidv4 = require('uuid/v4');
const querystring = require('querystring');
const builds = require('../lib/service/builds');
const { request } = require('./utils');
let restUrl;

describe('Builds', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/builds/status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/status`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to get build status', async () => {
            const payload = {
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath + `/${res.body.buildId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(200);
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('startTime');
            expect(response.body.status).to.equal('pending');
        });
    });
    describe('/builds/stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/stop`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                method: 'GET',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    buildId: 'no_such_id'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to stop build', async () => {
            const payload = {
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath,
                body: { buildId: res.body.buildId }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(200);
            expect(response.body.message).to.equal('OK');
        })
    });
    describe('/builds/rerun', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/rerun`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                method: 'GET',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    buildId: 'no_such_id'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to rerun build', async () => {
            const payload = {
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath,
                body: { buildId: res.body.buildId }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(400);
            expect(response.body.error.message).to.equal('unable to rerun build because its in pending status');
        })
    });
    describe('/builds/list', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/list`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ order: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ sort: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ limit: 0 });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ limit: "y" });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get build list', async () => {
            const body = {
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            };
            const payload = JSON.stringify(body);
            const formData1 = {
                payload,
                file: fse.createReadStream('tests/mocks/algorithm.zip')
            };
            const formData2 = {
                payload,
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const uri = restUrl + '/store/algorithms/apply';
            const options1 = {
                uri,
                formData: formData1
            };
            const options2 = {
                uri,
                formData: formData2
            };

            await request(options1);
            await request(options2)

            const limit = 2;
            const qs = querystring.stringify({ sort: 'desc', limit });

            const options = {
                uri: restPath + `/${body.name}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(200);
            expect(response.body).to.have.lengthOf(limit);
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('startTime');
            expect(response.body[0].status).to.equal('pending');

            expect(response.body[1]).to.have.property('status');
            expect(response.body[1]).to.have.property('startTime');
            expect(response.body[1].status).to.equal('pending');
        })
    });
    describe('/builds/fileInfo', () => {
        it('should success to extract fileInfo', async () => {
            const fileInfo = await builds._fileInfo({ name: 'algorithm.tar.gz', path: 'tests/mocks/algorithm.tar.gz' });
            expect(fileInfo).to.have.property('fileExt');
            expect(fileInfo).to.have.property('checksum');
            expect(fileInfo).to.have.property('fileSize');
            expect(fileInfo.fileExt).to.equal('gz');
            expect(fileInfo.checksum).to.be.string;
            expect(fileInfo.fileSize).to.equal(740);
        });
    });
});
