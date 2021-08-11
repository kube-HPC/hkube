const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const { request } = require('./utils');
const pipelines = require('./mocks/pipelines.json');
let restUrl, jobId;

const getJob = (jobId) => {
    const options = {
        uri: `${restUrl}/exec/pipelines/${jobId}`,
        method: 'GET'
    };
    return request(options);
};

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/caching', () => {
        let restPath = null;
        before(async () => {
            restPath = `${restUrl}/exec/caching`;
            const runRawPath = `${restUrl}/exec/raw`;
            const pipeline = pipelines.find((pl) => pl.name === 'flow1');
            const options = {
                uri: runRawPath,
                body: pipeline
            };
            const response = await request(options);
            jobId = response.body.jobId;
        });
        it('should succeed run caching', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'green'
                }
            };
            const { body: response } = await request(options);
            expect(response).not.to.have.property('error');
            expect(response).to.have.property('jobId');
            const { body: job } = await getJob(response.jobId);
            expect(job.nodes[0].kind).to.eql('algorithm');
            expect(job.types).to.not.contain('debug');
            expect(job.types).to.contain('node');
            expect(job.types).to.contain('raw');
        });
        it('should succeed run caching as raw (re-run)', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'green'
                }
            };
            const { body: response } = await request(options);
            const { body: job } = await getJob(response.jobId);
            expect(job.nodes[0].cacheJobId).to.exist;
            const rawRestPath = `${restUrl}/exec/raw`;
            const { body: rawResponse } = await request({ uri: rawRestPath, body: job })
            expect(rawResponse).to.not.have.property('error')

            const { body: rawJob } = await getJob(rawResponse.jobId);
            expect(rawJob.flowInputMetadata).to.have.property('metadata');
            expect(rawJob.flowInputMetadata).to.have.property('storageInfo');
        });
        it('should succeed run caching with debug', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'green',
                    debug: true
                }
            };
            const { body: response } = await request(options);
            expect(response).not.to.have.property('error');
            expect(response).to.have.property('jobId');
            const { body: job } = await getJob(response.jobId);
            expect(job.nodes[0].kind).to.eql('debug');
            expect(job.types).to.contain('debug');
            expect(job.types).to.contain('node');
            expect(job.types).to.contain('raw');
        });
        it('should fail on no jobId', async () => {
            const options = {
                uri: restPath,
                body: {
                    nodeName: 'black-alg'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should fail on additional property', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black-alg',
                    stam: 'klum'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data should NOT have additional properties (stam)');
        });
        it('should fail on no such node or job', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId: 'stam-job',
                    nodeName: 'stam-alg'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to find pipeline stam-job');
        });
        it('should succeed to execute with right types', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW, pipelineTypes.NODE]);
        });
        it('should succeed to execute with right flowInputMetadata', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.flowInputMetadata).to.have.property('metadata');
            expect(res2.body.flowInputMetadata).to.have.property('storageInfo');
        });
        it('should succeed to save the rootJobId', async () => {
            const options = {
                uri: restPath,
                body: {
                    jobId,
                    nodeName: 'black'
                }
            };
            await request(options);
            await request(options);
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.rootJobId).to.eql(jobId);
        });
    });
});
