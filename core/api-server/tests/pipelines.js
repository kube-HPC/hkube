const { expect } = require('chai');
const querystring = require('querystring');
const HttpStatus = require('http-status-codes');
const { workerStub } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Pipelines', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/pipelines/results', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/pipelines/results`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline results no_such_id Not Found');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ order: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ sort: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ limit: 0 });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ limit: "y" });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get pipelines results', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: pipeline
                }
            };
            const data = [100, 200, 300];
            const responses = await Promise.all(data.map(d => request(optionsRun)));
            await Promise.all(responses.map((r, i) => workerStub.done({ jobId: r.body.jobId, data: data[i] })));

            const qs = querystring.stringify({ sort: 'desc', limit: 3 });
            const options = {
                uri: restPath + `/${pipeline}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            const result = response.body.map(r => r.data).sort();
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(result).to.deep.equal(data);
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('data');
            expect(response.body[0]).to.have.property('storageModule');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timeTook');
            expect(response.body[0]).to.have.property('timestamp');
        })
    });
    describe('/pipelines/status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/pipelines/status`;
        });

        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline status no_such_id Not Found');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ order: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ sort: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ limit: 0 });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ limit: "y" });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get pipelines status', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: pipeline
                }
            };
            const limit = 3;
            await Promise.all(Array.from(Array(limit)).map(d => request(optionsRun)));

            const qs = querystring.stringify({ sort: 'desc', limit });
            const options = {
                uri: restPath + `/${pipeline}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body).to.have.lengthOf(limit)
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('level');
            expect(response.body[0]).to.have.property('pipeline');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timestamp');
        })
    });
});
