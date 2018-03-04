
const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const requestClient = require('request');
const clone = require('clone');
const bootstrap = require('../bootstrap');
const stateManager = require('../lib/state/state-manager');
const pipelines = require('./mocks/pipelines.json');
const webhookStub = require('./mocks/webhook-stub');
let config;
let baseUrl;

// TODO: WRITE DOCS ON WEBHOOKS

function _request(options) {
    return new Promise((resolve, reject) => {
        requestClient({
            method: options.method || 'POST',
            uri: options.uri,
            json: true,
            body: options.body
        }, (error, response, body) => {
            if (error) {
                return reject(error);
            }
            return resolve({ body, response });
        });
    });
}

describe('Test', () => {
    before(async () => {
        config = await bootstrap.init();
        baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}/${config.rest.prefix}`;
        await Promise.all(pipelines.map(p => stateManager.setPipeline(p)));
        webhookStub.start();
    });
    describe('Rest-API v1', () => {
        let restUrl = null;
        before(() => {
            restUrl = baseUrl + config.rest.versions[0];
        });
        describe('Execution', () => {
            describe('/exec/raw', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of required property nodes', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    algorithmName: 'green-alg',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                
                it('should throw validation error of nodes.input should be array', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw validation error of duplicate node', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate node dup');
                });
                it('should throw validation error priority range', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'dup',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            priority: 8
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.priority should be <= 5');
                });
                it('should succeed and return execution id', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
            describe('/exec/stored', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw pipeline not found', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'not_found'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_found Not Found');
                });
                it('should succeed and return execution id', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'flow1'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
            describe('/exec/stop', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stop',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: { jobId: 'no_such_id' }
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
                });
                it('should succeed to stop', async () => {
                    const optionsStored = {
                        uri: restUrl + '/exec/stored',
                        body: { name: 'flow1' }
                    };
                    const stored = await _request(optionsStored);
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { jobId: stored.body.jobId }
                    };
                    const response = await _request(optionsStop);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/exec/status', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/status',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw status Not Found with params', async () => {
                    const options = {
                        uri: restUrl + '/exec/status/no_such_id',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('status no_such_id Not Found');
                });
                it('should throw validation error of required property execution id', async () => {
                    const options = {
                        uri: restUrl + '/exec/status',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
                it('should succeed to get status', async () => {
                    const optionsRun = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'flow1'
                        }
                    };
                    const responseRun = await _request(optionsRun);

                    const options = {
                        uri: restUrl + `/exec/status/${responseRun.body.jobId}`,
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(200);
                    expect(response.body).to.have.property('data');
                    expect(response.body).to.have.property('jobId');
                    expect(response.body).to.have.property('timestamp');
                });
            });
            describe('/exec/results', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/results',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw status Not Found with params', async () => {
                    const options = {
                        uri: restUrl + '/exec/results/no_such_id',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('status no_such_id Not Found');
                });
                it('should throw validation error of required property execution id', async () => {
                    const options = {
                        uri: restUrl + '/exec/results',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
            });
        });
        describe('Store', () => {
            describe('/store/pipelines:name GET', () => {
                it('should throw error pipeline not found', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
                });
                it('should return specific pipeline', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow1',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.deep.equal(pipelines[0]);
                });
            });
            describe('/store/pipelines:name DELETE', () => {
                it('should throw error pipeline not found', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'DELETE',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
                });
                it('should delete specific pipeline', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow2',
                        method: 'DELETE',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/store/pipelines GET', () => {
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.be.an('array');
                });
            });
            describe('/store/pipelines POST', () => {
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of required property nodes', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    algorithmName: 'green-alg',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                
                it('should throw validation error of nodes.input should be array', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw conflict error', async () => {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = 'flow1';
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(409);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.message).to.equal('pipeline flow1 already exists');
                });
                it('should throw validation error of duplicate node', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate node dup');
                });
                it('should throw validation error of invalid reserved name flowInput', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('pipeline reservedName has invalid reserved name flowInput');
                });
                it('should throw validation error of node depend on not exists node', async () => {
                    const pipeline = pipelines.find(p => p.name === 'NodeNotExists');
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('node B is depend on C which is not exists');
                });
                it('should throw validation error of cyclic nodes', async () => {
                    const pipeline = pipelines.find(p => p.name === 'cyclicNodes');
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('pipeline cyclicNodes has cyclic nodes');
                });
                it('should throw validation error of flowInput not exist', async () => {
                    const options = {
                        method: 'POST',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('unable to find flowInput.notExist');
                });
                it('should succeed to store pipeline', async () => {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = uuidv4();
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(201);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/store/pipelines PUT', () => {
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: pipelines[0]
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
                it('should throw validation error of less than 2 properties', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: {
                            name: 'updatePipeline'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have less than 2 properties');
                });
            });
        });
        describe('Webhooks', () => {
            describe('Results', () => {
            });
            describe('Progress', () => {
                it('should succeed to post a webhook', async () => {
                    let jobId = null;
                    webhookStub.on('progress', async (request) => {
                        if (request.body.jobId === jobId) {
                            expect(request.body).to.have.property('data');
                            expect(request.body).to.have.property('jobId');
                            expect(request.body).to.have.property('timestamp');

                            const status = {
                                uri: restUrl + `/exec/status/${jobId}`,
                                method: 'GET'
                            };
                            const responseStatus = await _request(status);
                            expect(request.body).to.deep.equal(responseStatus.body);
                        }
                    });
                    const stored = {
                        uri: restUrl + '/exec/stored',
                        body: { name: 'webhookFlow' }
                    };
                    const response = await _request(stored);
                    jobId = response.body.jobId; // eslint-disable-line
                });
                it('should throw webhooks validation error of should match format "url', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress: 'not_a_url'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.webhooks.progress should match format "url"');
                });
                it('should throw webhooks validation error of NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress2: 'http://localhost'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.webhooks should NOT have additional properties');
                });
                it('should throw webhooks validation error', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress: 'http://localhost'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
        });
    });
    describe('Rest-API v2', () => {
        let restUrl = null;
        before(() => {
            restUrl = baseUrl + config.rest.versions[1];
        });
        describe('Execution', () => {
            describe('/exec/raw', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of required property nodes', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    algorithmName: 'green-alg',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                
                it('should throw validation error of nodes.input should be array', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw validation error of duplicate node', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate node dup');
                });
                it('should throw validation error priority range', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'dup',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            priority: 8
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.priority should be <= 5');
                });
                it('should succeed and return execution id', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
            describe('/exec/stored', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw pipeline not found', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'not_found'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_found Not Found');
                });
                it('should succeed and return execution id', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'flow1'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
            describe('/exec/stop', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stop',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: { jobId: 'no_such_id' }
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
                });
                it('should succeed to stop', async () => {
                    const optionsStored = {
                        uri: restUrl + '/exec/stored',
                        body: { name: 'flow1' }
                    };
                    const stored = await _request(optionsStored);
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { jobId: stored.body.jobId }
                    };
                    const response = await _request(optionsStop);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/exec/status', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/status',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw status Not Found with params', async () => {
                    const options = {
                        uri: restUrl + '/exec/status/no_such_id',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('status no_such_id Not Found');
                });
                it('should throw validation error of required property execution id', async () => {
                    const options = {
                        uri: restUrl + '/exec/status',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
                it('should succeed to get status', async () => {
                    const optionsRun = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            name: 'flow1'
                        }
                    };
                    const responseRun = await _request(optionsRun);

                    const options = {
                        uri: restUrl + `/exec/status/${responseRun.body.jobId}`,
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(200);
                    expect(response.body).to.have.property('data');
                    expect(response.body).to.have.property('jobId');
                    expect(response.body).to.have.property('timestamp');
                });
            });
            describe('/exec/results', () => {
                it('should throw Method Not Allowed', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/results',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                });
                it('should throw status Not Found with params', async () => {
                    const options = {
                        uri: restUrl + '/exec/results/no_such_id',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('status no_such_id Not Found');
                });
                it('should throw validation error of required property execution id', async () => {
                    const options = {
                        uri: restUrl + '/exec/results',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'jobId'");
                });
            });
        });
        describe('Store', () => {
            describe('/store/pipelines:name GET', () => {
                it('should throw error pipeline not found', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
                });
                it('should return specific pipeline', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow1',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.deep.equal(pipelines[0]);
                });
            });
            describe('/store/pipelines:name DELETE', () => {
                it('should throw error pipeline not found', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'DELETE',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('pipeline not_exists Not Found');
                });
                it('should delete specific pipeline', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow3',
                        method: 'DELETE',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/store/pipelines GET', () => {
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'GET'
                    };
                    const response = await _request(options);
                    expect(response.body).to.be.an('array');
                });
            });
            describe('/store/pipelines POST', () => {
                it('should throw validation error of required property name', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {}
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: {}
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should be string');
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: ''
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                });
                it('should throw validation error of required property nodes', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    algorithmName: 'green-alg',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    input: [
                                        {}
                                    ]
                                }
                            ]
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                
                it('should throw validation error of nodes.input should be array', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of data should NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have additional properties');
                });
                it('should throw conflict error', async () => {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = 'flow1';
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(409);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.message).to.equal('pipeline flow1 already exists');
                });
                it('should throw validation error of duplicate node', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate node dup');
                });
                it('should throw validation error of invalid reserved name flowInput', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('pipeline reservedName has invalid reserved name flowInput');
                });
                it('should throw validation error of node depend on not exists node', async () => {
                    const pipeline = pipelines.find(p => p.name === 'NodeNotExists');
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('node B is depend on C which is not exists');
                });
                it('should throw validation error of cyclic nodes', async () => {
                    const pipeline = pipelines.find(p => p.name === 'cyclicNodes');
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('pipeline cyclicNodes has cyclic nodes');
                });
                it('should throw validation error of flowInput not exist', async () => {
                    const options = {
                        method: 'POST',
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
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('unable to find flowInput.notExist');
                });
                it('should succeed to store pipeline', async () => {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = uuidv4();
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    };
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(201);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/store/pipelines PUT', () => {
                it('should throw validation error of required property jobId', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: pipelines[0]
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
                it('should throw validation error of less than 2 properties', async () => {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: {
                            name: 'updatePipeline'
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data should NOT have less than 2 properties');
                });
            });
        });
        describe('Webhooks', () => {
            describe('Results', () => {
            });
            describe('Progress', () => {
                it('should succeed to post a webhook', async () => {
                    let jobId = null;
                    webhookStub.on('progress', async (request) => {
                        if (request.body.jobId === jobId) {
                            expect(request.body).to.have.property('data');
                            expect(request.body).to.have.property('jobId');
                            expect(request.body).to.have.property('timestamp');

                            const status = {
                                uri: restUrl + `/exec/status/${jobId}`,
                                method: 'GET'
                            };
                            const responseStatus = await _request(status);
                            expect(request.body).to.deep.equal(responseStatus.body);
                        }
                    });
                    const stored = {
                        uri: restUrl + '/exec/stored',
                        body: { name: 'webhookFlow' }
                    };
                    const response = await _request(stored);
                    jobId = response.body.jobId; // eslint-disable-line
                });
                it('should throw webhooks validation error of should match format "url', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress: 'not_a_url'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.webhooks.progress should match format "url"');
                });
                it('should throw webhooks validation error of NOT have additional properties', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress2: 'http://localhost'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('data.webhooks should NOT have additional properties');
                });
                it('should throw webhooks validation error', async () => {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            name: 'string',
                            nodes: [
                                {
                                    nodeName: 'string',
                                    algorithmName: 'green-alg',
                                    input: []
                                }
                            ],
                            webhooks: {
                                progress: 'http://localhost'
                            }
                        }
                    };
                    const response = await _request(options);
                    expect(response.body).to.have.property('jobId');
                });
            });
        });
    });
});

