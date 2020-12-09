const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const stateManager = require('../lib/state/state-manager');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/pause', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/pause`;
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
        it('should not succeed to pause completed pipeline', async () => {
            const pipeline = 'flow1';
            const runStored = {
                uri: restUrl + '/exec/stored',
                body: { name: pipeline }
            };
            const status = 'completed';
            const stored = await request(runStored);
            const jobId = stored.body.jobId;
            await stateManager.updateJobStatus({ jobId, status });
            const response = await request({ uri: restPath, body: { jobId } });
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`unable to pause pipeline ${pipeline} because its in ${status} status`);
        });
        it('should succeed to pause', async () => {
            const runStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const stored = await request(runStored);
            const optionsStop = {
                uri: restPath,
                body: { jobId: stored.body.jobId }
            };
            const response = await request(optionsStop);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal('OK');
        });
    });
});
