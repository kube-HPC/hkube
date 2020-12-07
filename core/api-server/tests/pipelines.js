const { expect } = require('chai');
const querystring = require('querystring');
const HttpStatus = require('http-status-codes');
const { workerStub } = require('./mocks');
const pipelinesTriggers = require('./mocks/pipelines-triggers.json')
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
                uri: restPath + '?name=no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline results no_such_id Not Found');
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ name: 'pipe', order: 'bla' });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: 0 });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: "y" });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get pipelines results', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: pipeline,
                    experimentName: 'main'
                }
            };
            const data = [100, 200, 300];
            const responses = await Promise.all(data.map(d => request(optionsRun)));
            await Promise.all(responses.map((r, i) => workerStub.done({ jobId: r.body.jobId, data: data[i] })));

            const qs = querystring.stringify({ name: pipeline, sort: 'desc', limit: 3 });
            const options = {
                uri: `${restPath}?${qs}`,
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
                uri: restPath + '?name=no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline status no_such_id Not Found');
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ name: 'pipe', order: 'bla' });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ name: 'pipe', sort: 'bla' });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: 0 });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: "y" });
            const options = {
                uri: restPath + `?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get pipelines status', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: pipeline,
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const status = 'completed';
            const data = [status, status, status];
            const responses = await Promise.all(data.map(d => request(optionsRun)));
            await Promise.all(responses.map((r, i) => workerStub.done({ jobId: r.body.jobId, data: data[i] })));

            const qs = querystring.stringify({ name: pipeline, sort: 'desc', limit: 3 });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            const result = response.body.map(r => r.status)
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(result).to.deep.equal(data);
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timestamp');
        })
    });
    describe('/pipelines/triggers/tree', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/pipelines/triggers/tree`;
        });
        it('should throw triggers tree trigger-tree Not Found', async () => {
            const options = {
                uri: `${restPath}?name=trigger-tree`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('triggers tree trigger-tree Not Found');
        });
        it('should succeed to get pipelines triggers tree by name', async () => {
            const options = {
                uri: `${restPath}?name=trigger-tree-1`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(pipelinesTriggers);
        });
        it('should succeed to get partial pipelines triggers tree', async () => {
            const options = {
                uri: `${restPath}?name=trigger-tree-2`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(pipelinesTriggers[0].children);
        });
    });
});
