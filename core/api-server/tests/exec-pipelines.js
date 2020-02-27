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
    describe('/exec/pipelines', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/pipelines`;
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                method: 'GET',
                uri: restPath + '/not_exists',
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal("pipeline not_exists Not Found");
        });
        it('should throw validation error if algorithmName not exists', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'exec_pipeline',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'dummy',
                            input: []
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal("algorithm dummy Not Found");
        });
        it('should succeed and return job id', async () => {
            const options1 = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'exec_pipeline',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: [],
                            metrics: { tensorboard: true }
                        }
                    ]
                }
            };
            const response1 = await request(options1);
            const options = {
                method: 'GET',
                uri: restPath + '/' + response1.body.jobId,
            };
            const response2 = await request(options);
            expect(response2.body).to.have.property('name');
            expect(response2.body).to.have.property('nodes');
            expect(response2.body).to.have.property('options');
            expect(response2.body).to.have.property('priority');
            expect(response2.body).to.have.property('startTime');
            expect(response2.body.name).to.have.string(options1.body.name);
            expect(response2.body.nodes).to.deep.equal(options1.body.nodes);
        });
        it('should exec stored pipeline with concurrent and failed if reached the max number', async () => {
            const rp = await stateManager.executions.running.list({ jobId: 'concurrentPipelinesReject:' });
            await Promise.all(rp.map(p => stateManager.executions.running.delete({ jobId: p.jobId })));
            const pipeline = pipelines.find(p => p.name === 'concurrentPipelinesReject');

            const options = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: pipeline.name
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');

            const response1 = await request(options);
            expect(response1.body).to.have.property('jobId');

            const response2 = await request(options);
            expect(response2.body).to.have.property('error');
            expect(response2.body.error.message).to.equal(`maximum number [${pipeline.options.concurrentPipelines.amount}] of concurrent pipelines has been reached`);

        });
        it('should exec stored pipeline with concurrent and success if reached the max number', async () => {
            const rp = await stateManager.executions.running.list({ jobId: 'concurrentPipelinesResolve:' });
            await Promise.all(rp.map(p => stateManager.executions.running.delete({ jobId: p.jobId })));
            const pipeline = pipelines.find(p => p.name === 'concurrentPipelinesResolve');

            const options = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: pipeline.name
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');

            const response1 = await request(options);
            expect(response1.body).to.have.property('jobId');

            const response2 = await request(options);
            expect(response2.body).to.have.property('jobId');

        });
    });
});
