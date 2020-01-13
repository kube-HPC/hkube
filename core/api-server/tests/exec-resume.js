const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/resume', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/resume`;
        });
        it('should throw validation error of required property jobId', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should throw validation error of jobId Not Found', async () => {
            const options = {
                uri: restPath,
                body: { jobId: 'no_such_id' }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
        });
        it('should succeed to resume', async () => {
            const stored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const res1 = await request(stored);
            const { jobId } = res1.body;

            const pause = {
                uri: restUrl + '/exec/pause',
                body: { jobId }
            };
            await request(pause);

            const resume = {
                uri: restPath,
                body: { jobId }
            };
            const response = await request(resume);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal('OK');
        });
    });
});
