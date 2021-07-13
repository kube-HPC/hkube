const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { pipelineTypes, nodeKind } = require('@hkube/consts');
const validationMessages = require('../lib/consts/validationMessages.js');
const { pipelines } = require('./mocks');
const { request, delay } = require('./utils');
const stateManager = require('../lib/state/state-manager');

let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/rerun', () => {
        let restPath = null;
        before(async () => {
            restPath = `${restUrl}/exec/rerun`;
        });
        it('should throw validation error of required property jobId', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should throw jobId not found', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId: 'not_found'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('jobId not_found Not Found');
        });
        it('should succeed and return job id', async () => {
            const opt1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: 'flow1'
                }
            };
            const res = await request(opt1);
            const opt2 = {
                uri: restPath,
                body: {
                    jobId: res.body.jobId
                }
            };
            const response1 = await request(opt2);
            const response2 = await request(opt2);
            const response3 = await request(opt2);
            expect(response1.body).to.have.property('jobId');
            expect(response2.body).to.have.property('jobId');
            expect(response3.body).to.have.property('jobId');
        });
    });
});
