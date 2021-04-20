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
});
