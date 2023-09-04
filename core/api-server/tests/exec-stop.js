const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stop`;
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
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: { jobId: 'no_such_id' }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
        });
        it('should succeed to stop jobs without startTime filter', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const stored = await request(optionsStored);
            const optionsStop = {
                uri: restPath,
                body: { jobId: stored.body.jobId }
            };
            const response = await request(optionsStop);
            expect(response.body.error).to.not.exist;
            expect(response.body.message).to.equal('OK');
        });
        it('should succeed to stop jobs with startTime filter', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow2' }
            };
            const stored = await request(optionsStored);
            const optionsStop = {
                uri: restPath,
                body: {
                    jobId: stored.body.jobId,
                    pipelineName: 'flow2',
                    startTime: {
                        from: '2021-09-04T00:00:00Z',
                        to: '2024-09-04T23:59:59Z'
                    }
                }
            };
            const response = await request(optionsStop);
            expect(response.body.error).to.not.exist; // No error should be present
            expect(response.body.message).to.equal('OK');
        });
    });
});
