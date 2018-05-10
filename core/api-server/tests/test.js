
const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const requestClient = require('request');
const clone = require('clone');
const bootstrap = require('../bootstrap');
const stateManager = require('../lib/state/state-manager');
const algorithms = require('./mocks/algorithms.json');
const pipelines = require('./mocks/pipelines.json');
const triggersTreeExpected = require('./mocks/triggers-tree.json');
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

describe('Rest', () => {
    before(async () => {
        config = await bootstrap.init();
        baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
        await Promise.all(pipelines.map(p => stateManager.setPipeline(p)));
        await Promise.all(algorithms.map(p => stateManager.setAlgorithm(p)));
        webhookStub.start();
    });
    const versions = ['v1', 'v2'];
    versions.forEach((v) => {
        describe(`Rest-API ${v}`, () => {
            let restUrl = null;
            before(() => {
                restUrl = `${baseUrl}/${config.rest.prefix}/${v}`;
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
                describe('/exec/tree', () => {
                    it('pipeline call stack by trigger', async () => {
                        let prefix = '57ec5c39-122b-4d7c-bc8f-580ba30df511';
                        await Promise.all([
                            stateManager.setExecution({ jobId: prefix + '.a', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.e', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.e.f', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.g', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.i', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.l', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.o', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.p', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.b.m', data: { startTime: Date.now() } }),
                            stateManager.setExecution({ jobId: prefix + '.a.n', data: { startTime: Date.now() } })
                        ]);

                        const options = {
                            method: 'GET',
                            uri: `${restUrl}/exec/tree/${prefix}.a`
                        };
                        const response = await _request(options);
                        expect(response.body).to.deep.equal(triggersTreeExpected);
                    });
                    it('should failed if jobId not found', async () => {

                        const options = {
                            method: 'GET',
                            uri: `${restUrl}/exec/tree/${uuidv4()}`
                        };
                        const response = await _request(options);
                        expect(response.response.statusCode).to.deep.equal(404);
                    });
                });
            });
            describe('Store/Algorithms', () => {
                describe('/store/algorithms:name GET', () => {
                    it('should throw error algorithm not found', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms/not_exists',
                            method: 'GET'
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('error');
                        expect(response.body.error.code).to.equal(404);
                        expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
                    });
                    it('should return specific algorithm', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms/' + algorithms[0].name,
                            method: 'GET'
                        };
                        const response = await _request(options);
                        expect(response.body).to.deep.equal(algorithms[0]);
                    });
                });
                describe('/store/algorithms:name DELETE', () => {
                    it('should throw error algorithm not found', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms/not_exists',
                            method: 'DELETE',
                            body: {}
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('error');
                        expect(response.body.error.code).to.equal(404);
                        expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
                    });
                    it('should delete specific algorithm', async () => {
                        const optionsInsert = {
                            uri: restUrl + '/store/algorithms',
                            method: 'POST',
                            body: {
                                name: "delete",
                                algorithmImage: "image"
                            }
                        };
                        await _request(optionsInsert);

                        const options = {
                            uri: restUrl + '/store/algorithms/delete',
                            method: 'DELETE',
                            body: {}
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('message');
                        expect(response.body.message).to.equal('OK');
                    });
                });
                describe('/store/algorithms GET', () => {
                    it('should throw validation error of required property jobId', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms',
                            method: 'GET'
                        };
                        const response = await _request(options);
                        expect(response.body).to.be.an('array');
                    });
                });
                describe('/store/algorithms POST', () => {
                    it('should throw validation error of required property name', async () => {
                        const options = {
                            method: 'POST',
                            uri: restUrl + '/store/algorithms',
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
                            uri: restUrl + '/store/algorithms',
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
                            uri: restUrl + '/store/algorithms',
                            body: {
                                name: ''
                            }
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('error');
                        expect(response.body.error.code).to.equal(400);
                        expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
                    });
                    it('should throw conflict error', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms',
                            method: 'POST',
                            body: {
                                name: "conflict",
                                algorithmImage: "image"
                            }
                        };
                        await _request(options);
                        const response = await _request(options);
                        expect(response.response.statusCode).to.equal(409);
                        expect(response.body).to.have.property('error');
                        expect(response.body.error.message).to.equal('algorithm conflict already exists');
                    });
                    it('should succeed to store algorithm', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms',
                            method: 'POST',
                            body: {
                                name: uuidv4(),
                                algorithmImage: "image"
                            }
                        };
                        const response = await _request(options);
                        expect(response.response.statusCode).to.equal(201);
                        expect(response.body).to.have.property('message');
                        expect(response.body.message).to.equal('OK');
                    });
                });
                describe('/store/algorithms PUT', () => {
                    it('should succeed to update algorithm', async () => {
                        const options = {
                            uri: restUrl + '/store/algorithms',
                            method: 'PUT',
                            body: algorithms[0]
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('message');
                        expect(response.body.message).to.equal('OK');
                    });
                });
            });
            describe('Store/Pipelines', () => {
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
                        const pipeline = clone(pipelines[0]);
                        const optionsInsert = {
                            uri: restUrl + '/store/pipelines',
                            method: 'POST',
                            body: pipeline
                        };
                        await _request(optionsInsert);

                        const options = {
                            uri: restUrl + '/store/pipelines/' + pipeline.name,
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
                        await _request(options);
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
                    it('should succeed to update pipeline', async () => {
                        const options = {
                            uri: restUrl + '/store/pipelines',
                            method: 'PUT',
                            body: pipelines[0]
                        };
                        const response = await _request(options);
                        expect(response.body).to.have.property('message');
                        expect(response.body.message).to.equal('OK');
                    });
                });
            });
            describe('Webhooks', () => {
                describe('Results', () => {
                });
                describe('Progress', () => {
                    let restUrl = null;
                    before(() => {
                        restUrl = `${baseUrl}/${config.rest.prefix}/${v}`;
                    });
                    it('should succeed to post a webhook', async () => {
                        let jobId = null;
                        webhookStub.on('progress', async (request) => {
                            if (request.body.jobId === jobId) {
                                expect(request.body).to.have.property('data');
                                expect(request.body).to.have.property('jobId');
                                expect(request.body).to.have.property('timestamp');

                                const status = {
                                    uri: restUrl + `/ exec / status / ${jobId} `,
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
});
describe('Rest internal', () => {
    let restUrl = null;
    before(() => {
        restUrl = `${baseUrl}/internal/v1`;
    });
    it('should succeed and return job id', async () => {
        const options = {
            method: 'POST',
            uri: `${restUrl}/exec/stored`,
            body: {
                name: 'flow1'
            }
        };
        const response = await _request(options);
        expect(response.body).to.have.property('jobId');
    });
    it('should succeed without reaching too many request', async () => {
        const requests = 10;
        const promises = [];
        const options = {
            method: 'POST',
            uri: `${restUrl}/exec/stored`,
            body: {
                name: 'flow1'
            }
        };
        for (let i = 0; i < requests; i++) {
            promises.push(_request(options));
        }
        const response = await Promise.all(promises);
        const jobs = response.map(r => r.body.jobId);
        expect(jobs).to.have.lengthOf(requests);
        expect(jobs.every(j => j.includes(options.body.name))).to.equal(true);
    });
    it('pipeline call stack by trigger', async () => {
        let prefix = '57ec5c39-122b-4d7c-bc8f-580ba30df511';
        await Promise.all([
            stateManager.setExecution({ jobId: prefix + '.a', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.e', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.e.f', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.g', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.i', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.l', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.o', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.c.d.h.j.k.p', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.b.m', data: { startTime: Date.now() } }),
            stateManager.setExecution({ jobId: prefix + '.a.n', data: { startTime: Date.now() } })
        ]);
        let r = await stateManager.getExecutionsTree({ jobId: prefix + '.a' });
        expect(r).to.deep.equal(triggersTreeExpected);
    });
});

