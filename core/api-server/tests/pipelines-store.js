const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const clone = require('clone');
const { pipelineStatuses, nodeKind } = require('@hkube/consts');
const { uuid } = require('@hkube/uid');
const { pipelines } = require('./mocks');
const { request } = require('./utils');
const stateManager = require('../lib/state/state-manager');
let restUrl, restPath;

describe('Store/Pipelines', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/store/pipelines`;
    });
    describe('/store/pipelines:name GET', () => {
        it('should throw error pipeline not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
        });
        it('should return specific pipeline', async () => {
            const options = {
                uri: restPath + '/flow1',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(pipelines[0]);
        });
    });
    describe('/store/pipelines:name DELETE', () => {
        it('should throw error pipeline not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
        });
        it('should delete specific pipeline', async () => {
            const pipeline = clone(pipelines[0]);
            const optionsInsert = {
                uri: restPath,
                body: pipeline
            };
            await request(optionsInsert);

            const options = {
                uri: `${restPath}/${pipeline.name}`,
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('successfully deleted from store');
        });
        it('should delete pipeline with some dependencies', async () => {
            const pipeline = clone(pipelines[0]);
            const pipelineName = uuid();
            const optionsInsert = {
                uri: restPath,
                body: { ...pipeline, name: pipelineName }
            };
            await request(optionsInsert);
            const options1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: pipelineName
                }
            };
            await request(options1);
            await request(options1);
            const res = await request(options1);
            const jobId = res.body.jobId;
            await stateManager.updateJobStatus({ jobId, status: pipelineStatuses.STOPPED });
            await stateManager.updateJobResult({ jobId, status: pipelineStatuses.STOPPED });

            const options2 = {
                uri: `${restPath}/${pipelineName}`,
                method: 'DELETE'
            };
            const response2 = await request(options2);
            expect(response2.body.message).to.equal(`pipeline ${pipelineName} successfully deleted from store, stopped related running pipelines 2/2`);
        });
    });
    describe('/store/pipelines GET', () => {
        it('should get all pipelines', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.be.an('array');
        });
    });
    describe('/store/pipelines POST', () => {
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
        it('should throw validation error of required property nodes', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('pipeline must have at least one node');
        });
        it('should throw validation error of required property nodes.nodeName', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            algorithmName: 'green-alg',
                            input: [{}]
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.eql("data.nodes[0] should have required property 'nodeName'");
        });
        it('should throw validation error of cron trigger', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.triggers = {
                cron: {
                    pattern: 'bla'
                }
            };
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.triggers.cron.pattern should match format "cron"');
        });
        it('should throw validation error of pipelines trigger should be array', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.triggers = {
                pipelines: 1
            };
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.triggers.pipelines should be array');
        });
        it('should throw validation error of pipelines trigger should NOT be shorter than 1 characters', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.triggers = {
                pipelines: ['']
            };
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.triggers.pipelines[0] should NOT be shorter than 1 characters');
        });
        it('should throw validation error of required property nodes.algorithmName', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string'
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.contain('please provide algorithm name');
        });
        it('should throw validation error of nodes.input should be array', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: null
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
        });
        it('should not throw validation error of data should NOT have additional properties', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    additionalProps: {
                        bla: 60,
                        blabla: 'info'
                    }
                }
            };
            const response = await request(options);
            expect(response.body.name).to.eql(options.body.name);
        });
        it('should throw conflict error', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.name = 'flow1';
            const options = {
                uri: restPath,
                body: pipeline
            };
            await request(options);
            const response = await request(options);
            expect(response.response.statusCode).to.equal(409);
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.equal('pipeline flow1 already exists');
        });
        it('should throw validation error of duplicate node', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'dup',
                            algorithmName: 'green-alg',
                            input: []
                        },
                        {
                            nodeName: 'dup',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('found duplicate node "dup"');
        });
        it('should throw validation error of invalid reserved name flowInput', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'reservedName',
                    nodes: [
                        {
                            nodeName: 'flowInput',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('pipeline "reservedName" has invalid reserved name "flowInput"');
        });
        it('should throw validation error of node depend on not exists node', async () => {
            const pipeline = pipelines.find((p) => p.name === 'NodeNotExists');
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('node "B" is depend on node "C" which is not exists');
        });
        it('should throw validation error of cyclic nodes', async () => {
            const pipeline = pipelines.find((p) => p.name === 'cyclicNodes');
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('cyclic nodes are not allowed on batch pipeline');
        });
        it('should throw validation error of flowInput not exist', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'flowInputPipeline',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: ['@flowInput.notExist']
                        }
                    ],
                    flowInput: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to find flowInput.notExist');
        });
        it('should throw validation error if algorithmName not exists', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.nodes[0].algorithmName = 'not.exists';
            pipeline.name = uuid();
            const body = pipeline;
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not.exists Not Found');
        });
        it('should throw validation error if debugOverride algorithm not in nodes', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.name = uuid();
            pipeline.options.debugOverride = ['not-exist']
            const body = pipeline;
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('debugOverride node not in nodes list');
        });
        it('should succeed to store pipeline', async () => {
            const pipeline = clone(pipelines[2]);
            pipeline.name = uuid();
            pipeline.description = 'my description';
            pipeline.tags = ['bla', 'hot'];
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.CREATED);
            expect(response.body).to.eql(pipeline);
            const storedPipeline = await request({
                uri: restPath + '/' + pipeline.name,
                method: 'GET'
            });
            const actual = storedPipeline.body;
            delete actual.modified;
            expect(actual).to.eql(pipeline);
        });
        it('should succeed to store pipeline and add defaults', async () => {
            const name = uuid();
            const options = {
                uri: restPath,
                body: {
                    name,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName: 'green-alg',
                            input: ['args']
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.CREATED);
            expect(response.body).to.have.property('name');
            expect(response.body).to.have.property('nodes');
            expect(response.body).to.have.property('options');
            expect(response.body).to.have.property('priority');
            expect(response.body.options).to.have.property('ttl');
            expect(response.body.options).to.not.have.property('activeTtl');
            expect(response.body.options).to.have.property('batchTolerance');
            expect(response.body.options).to.have.property('progressVerbosityLevel');

            expect(response.body.priority).to.equal(3);
            expect(response.body.options.ttl).to.equal(3600);
            expect(response.body.options.batchTolerance).to.equal(80);
            expect(response.body.options.progressVerbosityLevel).to.equal('info');
        });
        it('should succeed to store pip', async () => {
            const pipeline = {
                name: 'pipeline_in_pipeline',
                nodes: [
                    {
                        nodeName: 'A',
                        kind: nodeKind.Pipeline,
                        spec: {
                            name: 'simple-1'
                        },
                        input: []
                    },
                    {
                        nodeName: 'B',
                        kind: nodeKind.Pipeline,
                        spec: {
                            name: 'simple-1'
                        },
                        input: [{ data: '@A' }]
                    }
                ]
            };
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.CREATED);
        });
    });
    describe('/store/pipelines PUT', () => {
        it('should succeed to update pipeline', async () => {
            const pipeline = clone(pipelines[2]);
            pipeline.description = 'my description';
            pipeline.kind = 'stream';
            pipeline.nodes.forEach((n) => {
                n.kind = 'algorithm';
            });
            const options = {
                uri: restPath,
                method: 'PUT',
                body: pipeline
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(pipeline);
        });
        it('should throw validation error if algorithmName not exists', async () => {
            const pipeline = clone(pipelines[0]);
            pipeline.nodes[0].algorithmName = 'not.exists';
            const body = pipeline;
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not.exists Not Found');
        });
    });
});
