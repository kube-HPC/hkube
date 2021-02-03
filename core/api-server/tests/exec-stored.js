const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const validationMessages = require('../lib/consts/validationMessages.js');
const { pipelines } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/stored', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stored`;
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
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
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
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
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
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
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
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
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to find flowInput.files.links');
        });
        it('should throw entry node cannot be stateless', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('entry node "A" cannot be stateless on stream pipeline');
        });
        it('should throw stateful node is not allowed on batch pipeline', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'stateful'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('stateful node "one" is not allowed on batch pipeline');
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
            const pipeline = pipelines.find(p => p.name === 'options');
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
                        inp: [
                            [],
                            []
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
            expect(res2.body.flowInput).to.eql(options.body.flowInput);
        });
    });
});
