const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/auditTrail', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/auditTrail`;
        });
        it('should throw auditTrail Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('auditTrail no_such_id Not Found');
        });
        it('should throw validation error of required property execution id', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
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
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(response.body[0]).to.have.property('timestamp');
            expect(response.body[0]).to.have.property('user');
            expect(response.body[0]).to.have.property('action');
        });
    });
});
