const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/status`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('status no_such_id Not Found');
        });
        it('should throw validation error of required property execution id', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should succeed to get status', async () => {
            const optionsRun = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: 'flow1'
                }
            };
            const responseRun = await request(optionsRun);
            const options = {
                uri: restPath + `/${responseRun.body.jobId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body).to.have.property('jobId');
            expect(response.body).to.have.property('level');
            expect(response.body).to.have.property('pipeline');
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('timestamp');
        });
    });
});
