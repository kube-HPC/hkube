const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const stateManager = require('../../lib/state/state-manager');
const configIt = require('@hkube/config');
const { main: config, logger } = configIt.load();
const { pipelines } = require('../mocks');
const { request } = require('../utils');
const grequest = require('graphql-request');

const jobByNameQuery = require('./queries/job-by-name-query');
const aggregatedJobQuery = require('./queries/aggregated-job-query');
const req = grequest.request;
let restUrl;
let baseUrl;
let graphqlUrl
describe('graphql jobs', () => {
    before(() => {

        baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
        restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
        graphqlUrl = `${baseUrl}/graphql`;
    });
    describe('query jobs', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/jobs`;
        });
        beforeEach(async () => {
            const list = await stateManager.getRunningJobs();
            for (const job of list) {
                await stateManager._db.jobs.delete({ jobId: job.jobId });
            }
        });



        it('should return specific job ', async () => {

            await stateManager._db.jobs.create({ jobId: `job_${2}`, status: { status: 'pending' }, type: 'stored', pipeline: pipelines[0] });
            const res = await req(graphqlUrl, jobByNameQuery);
            expect(res.job.key).to.be.eql('job_2');

        });
        it('should query job by parameters', async () => {
            await stateManager._db.jobs.create({ jobId: `job_${2}`, status: { status: 'pending' }, type: 'stored', pipeline: pipelines[0] });
            const res = await req(graphqlUrl, aggregatedJobQuery);
            expect(res.jobsAggregated.jobs[0].key).to.be.eql('job_2');
            expect(res.jobsAggregated.cursor).to.be.not.null;

        });


    });
});
