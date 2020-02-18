const { expect } = require('chai');
const querystring = require('querystring');
const HttpStatus = require('http-status-codes');
const graphService = require('../lib/service/graph');
const graph = require('./mocks/graph.json');
const { request } = require('./utils');
let restUrl;

describe('Graph', () => {
    before(async () => {
        restUrl = global.testParams.restUrl;
        internalUrl = global.testParams.internalUrl;
        await graphService.setGraph({ jobId: graph.jobId, data: graph });
    });
    describe('/graph/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/graph/raw`;
        });
        it('should throw graph Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('graph no_such_id Not Found');
        });
        it('should throw validation error of required property jobId', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should success to get graph', async () => {
            const options = {
                uri: `${restPath}/${graph.jobId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.eql(graph);
        });
    });
    describe('/graph/parsed', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/graph/parsed`;
        });
        it('should throw validation error of required property jobId', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should throw graph Not Found', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('graph no_such_id Not Found');
        });
        it('should throw node Not Found', async () => {
            const qs = querystring.stringify({ node: 'no_such_id' });
            const options = {
                uri: `${restPath}/${graph.jobId}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('node no_such_id Not Found');
        });
        it('should success to get graph', async () => {
            const options = {
                uri: `${restPath}/${graph.jobId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.eql(graph);
        });
        it('should success to get node graph', async () => {
            const options = {
                uri: `${restPath}/${graph.jobId}?node=${graph.nodes[0].nodeName}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.nodes[0]).to.eql(graph.nodes[0]);
        });
        it('should success get sorted graph by status', async () => {
            const qs = querystring.stringify({ sort: 'status', order: 'asc' });
            const options = {
                uri: `${restPath}/${graph.jobId}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.nodes[0].batch[0].status).to.equal('active');
            expect(response.body.nodes[3].batch[0].status).to.equal('active');
        });
        it('should success get sorted graph by batchIndex', async () => {
            const qs = querystring.stringify({ sort: 'batchIndex', order: 'desc' });
            const options = {
                uri: `${restPath}/${graph.jobId}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            const batch = response.body.nodes[0].batch;
            expect(batch[0].batchIndex).to.equal(graph.nodes[0].batch[batch.length - 1].batchIndex);
        });
        it('should success get last five graph batch by batchIndex', async () => {
            const qs = querystring.stringify({ sort: 'batchIndex', order: 'desc', from: 0, to: 5 });
            const options = {
                uri: `${restPath}/${graph.jobId}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            const batch = response.body.nodes[0].batch;
            const gBatch = graph.nodes[0].batch;
            expect(batch[0].batchIndex).to.equal(gBatch[gBatch.length - 1].batchIndex);
        });
    });
});
