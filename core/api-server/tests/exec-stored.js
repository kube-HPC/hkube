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
    describe('/exec/stored', () => {
        let restPath = null;
        before(async () => {
            restPath = `${restUrl}/exec/stored`;
            await stateManager.deleteAlgorithm({ kind: nodeKind.Debug })
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: ''
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw pipeline not found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'not_found'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline not_found Not Found');
        });
        it('should throw validation error pipeline name', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec/stored'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.PIPELINE_NAME_FORMAT);
        });
        it('should throw unable to find flowInput', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flowInput'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to find flowInput.files.links');
        });
        it('should throw debugOverride algorithm not found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flow1',
                    options: {
                        debugOverride: ['not-exist']
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('debugOverride node not in nodes list');
        });
        it('should succeed and return job id', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flow1'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should succeed to execute with right types', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'types-check'
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.STORED, pipelineTypes.DEBUG, pipelineTypes.DEV_MODE]);
        });
        it('should succeed to execute and merge options', async () => {
            const pipeline = pipelines.find((p) => p.name === 'options');
            const options = {
                uri: restPath,
                body: {
                    name: 'options',
                    options: {
                        ttl: 255
                    }
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            const storedOptions = Object.keys(pipeline.options);
            const execOptions = Object.keys(res2.body.options);
            expect(res2.body.options.ttl).to.eql(options.body.options.ttl);
            expect(storedOptions).to.eql(execOptions);
        });
        it('should succeed to execute and override flowInput', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'override-flowInput',
                    flowInput: {
                        inp: [[], []]
                    }
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.flowInput).to.eql(options.body.flowInput);
        });
        it('should succeed to execute and override debug', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flow1',
                    options: {
                        debugOverride: [
                            'yellow',
                            'white'
                        ]
                    }
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.nodes[1].kind).to.eql('debug');
            expect(res2.body.nodes[3].kind).to.eql('debug');
        });
        it('should update debug algorithm modified time on execute', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flow1',
                    options: {
                        debugOverride: [
                            'yellow',
                            'white'
                        ]
                    }
                }
            };
            await request(options);
            const optionsGET = {
                uri: `${restUrl}/store/algorithms/yellow-alg-debug`,
                method: 'GET'
            };
            let res2 = await request(optionsGET);
            expect(Math.abs(res2.body.created - res2.body.modified)).to.closeTo(0, 100);
            await delay(1000)
            await request(options);
            res2 = await request(optionsGET);
            expect(Math.abs(res2.body.modified - res2.body.created)).to.be.above(1000)
        });
        it('should update debug algorithm modified time on completion', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'flow1',
                    options: {
                        debugOverride: [
                            'yellow',
                            'white'
                        ]
                    }
                }
            };
            const res = await request(options);
            await delay(1000)
            const results = {
                jobId: res.body.jobId,
                status: 'completed',
                data: [{ res1: 400 }, { res2: 500 }]
            };
            await stateManager.updateJobStatus(results);
            await stateManager.updateJobResult(results);
            await delay(300)
            const optionsGET = {
                uri: `${restUrl}/store/algorithms/yellow-alg-debug`,
                method: 'GET'
            };
            let res2 = await request(optionsGET);
            expect(Math.abs(res2.body.modified - res2.body.created)).to.be.above(1000)
        });
    });
});
