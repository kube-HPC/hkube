const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const stateManager = require('../lib/state/state-manager');
const { pipelines } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/jobs', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/jobs`;
        });
        beforeEach(async () => {
            const list = await stateManager.getActiveJobs();
            for (const job of list) {
                await stateManager.jobs.active.delete({jobId: job.jobId});
            }
        });
        
        it('should return empty list', async () => {
            const options = {
                method: 'GET',
                uri: restPath,
            };
            const response = await request(options);
            expect(response.body).to.be.empty
        });

        it('should return active list', async () => {
            const options = {
                method: 'GET',
                uri: `${restPath}?status=active`,
            };
            for (let i=0;i<2;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'active', type: 'stored'});
            }
            for (let i=2;i<6;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'pending', type: 'stored'});
            }
            const response = await request(options);
            expect(response.body).to.have.length(2)
        });

        it('should return pending list', async () => {
            const options = {
                method: 'GET',
                uri: `${restPath}?status=pending`,
            };
            for (let i=0;i<2;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'active', type: 'stored'});
            }
            for (let i=2;i<6;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'pending', type: 'stored'});
            }
            const response = await request(options);
            expect(response.body).to.have.length(4)
        });

        it('should return all list', async () => {
            const options = {
                method: 'GET',
                uri: `${restPath}`,
            };
            for (let i=0;i<111;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'active', type: 'stored'});
            }
            for (let i=111;i<300;i++) {
                await stateManager.jobs.active.set({jobId: `job_${i}`, status: 'pending', type: 'stored'});
            }
            const response = await request(options);
            expect(response.body).to.have.length(300)
        });
    });
});
