process.env.NODE_PATH = process.cwd();
require('module').Module._initPaths();

const { expect } = require('chai');
const sinon = require('sinon');
const uuidv4 = require('uuid/v4');
const request = require('request');
const clone = require('clone');
const bootstrap = require('../bootstrap');
const stateManager = require('lib/state/state-manager');
const pipelines = require('./mocks/pipelines.json');
const webhookStub = require('./mocks/webhook-stub');
let config, baseUrl;

/// TODO: WRITE DOCS ON WEBHOOKS

function _request(options) {
    return new Promise((resolve, reject) => {
        request({
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
    })
}

describe('Test', function () {
    before(async () => {
        config = await bootstrap.init();
        baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}/${config.rest.prefix}`
        await Promise.all(pipelines.map(p => stateManager.setPipeline(p)));
        webhookStub.start();
    })
    describe('Rest-API v1', function () {
        let restUrl = null;
        before(() => {
            restUrl = baseUrl + config.rest.versions[0];
        })
        describe('Execution', function () {
            describe('/exec/raw', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "algorithmName": "green-alg",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                it('should throw validation error of nodes.algorithmName one of the allowed values', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "string",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0].algorithmName should be equal to one of the allowed values");
                });
                it('should throw validation error of nodes.input should be array', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": null
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"

                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of required property webhooks', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'webhooks'");

                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");
                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            },
                            "additionalProps": {
                                "bla": 60,
                                "blabla": "info"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw validation error of duplicate nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                },
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate nodes dup');
                });
                it('should succeed and return execution id', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('execution_id');
                });
            });
            describe('/exec/stored', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");

                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw pipeline not found', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "not_found"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_found Not Found");
                });
                it('should succeed and return execution id', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "flow1"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('execution_id');
                });
            });
            describe('/exec/stop', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stop',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": 'no_such_id' }
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('execution_id no_such_id Not Found');
                });
                it('should succeed to stop', async function () {
                    const optionsStored = {
                        uri: restUrl + '/exec/stored',
                        body: { "name": "flow1" }
                    }
                    const stored = await _request(optionsStored);
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": stored.body.execution_id }
                    }
                    const response = await _request(optionsStop);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/exec/status', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/status',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw status Not Found with params', async function () {
                    const options = {
                        uri: restUrl + '/exec/status/no_such_id',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("status no_such_id Not Found");
                });
                it('should throw validation error of required property execution id', async function () {
                    const options = {
                        uri: restUrl + '/exec/status',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
                it('should succeed to get status', async function () {
                    const optionsRun = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "flow1"
                        }
                    }
                    const responseRun = await _request(optionsRun);

                    const options = {
                        uri: restUrl + `/exec/status/${responseRun.body.execution_id}`,
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(200);
                    expect(response.body).to.have.property('data');
                    expect(response.body).to.have.property('execution_id');
                    expect(response.body).to.have.property('timestamp');
                });
            });
            describe('/exec/results', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/results',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw status Not Found with params', async function () {
                    const options = {
                        uri: restUrl + '/exec/results/no_such_id',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("results no_such_id Not Found");
                });
                it('should throw validation error of required property execution id', async function () {
                    const options = {
                        uri: restUrl + '/exec/results',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
            });
        });
        describe('Store', function () {
            describe('/store/pipelines:name GET', function () {
                it('should throw error pipeline not found', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_exists Not Found");
                });
                it('should return specific pipeline', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow1',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.deep.equal(pipelines[0]);
                });
            });
            describe('/store/pipelines:name DELETE', function () {
                it('should throw error pipeline not found', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'DELETE',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_exists Not Found");
                });
                it('should delete specific pipeline', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow2',
                        method: 'DELETE',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal("OK");
                });
            });
            describe('/store/pipelines GET', function () {
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.be.an('array');
                });
            });
            describe('/store/pipelines POST', function () {
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "algorithmName": "green-alg",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                it('should throw validation error of nodes.algorithmName one of the allowed values', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "string",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0].algorithmName should be equal to one of the allowed values");
                });
                it('should throw validation error of nodes.input should be array', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": null
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"

                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of required property webhooks', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'webhooks'");

                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");
                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            },
                            "additionalProps": {
                                "bla": 60,
                                "blabla": "info"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw conflict error', async function () {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = 'flow1';
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(409);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.message).to.equal('pipeline flow1 already exists');
                });
                it('should succeed to store pipeline', async function () {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = uuidv4();
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(201);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
                it('should throw validation error of duplicate nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                },
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate nodes dup');
                });
            });
            describe('/store/pipelines PUT', function () {
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: pipelines[0]
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
        });
        describe('Webhooks', function () {
            describe('Results', function () {
            });
            describe('Progress', function () {
                it('should succeed to post a webhook', async function () {
                    let execution_id = null;
                    webhookStub.on('progress', async (request) => {
                        if (request.body.execution_id === execution_id) {
                            expect(request.body).to.have.property('data');
                            expect(request.body).to.have.property('execution_id');
                            expect(request.body).to.have.property('timestamp');

                            const status = {
                                uri: restUrl + `/exec/status/${execution_id}`,
                                method: 'GET'
                            }
                            const responseStatus = await _request(status);
                            expect(request.body).to.deep.equal(responseStatus.body);
                        }
                    })
                    const stored = {
                        uri: restUrl + '/exec/stored',
                        body: { "name": "webhookFlow" }
                    }
                    const response = await _request(stored);
                    execution_id = response.body.execution_id;
                });
            });
        });
    });
    describe('Rest-API v2', function () {
        let restUrl = null;
        before(() => {
            restUrl = baseUrl + config.rest.versions[1];
        })
        describe('Execution', function () {
            describe('/exec/raw', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "algorithmName": "green-alg",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                it('should throw validation error of nodes.algorithmName one of the allowed values', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "string",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0].algorithmName should be equal to one of the allowed values");
                });
                it('should throw validation error of nodes.input should be array', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": null
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"

                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of required property webhooks', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'webhooks'");

                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");
                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            },
                            "additionalProps": {
                                "bla": 60,
                                "blabla": "info"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw validation error of duplicate nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                },
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate nodes dup');
                });
                it('should succeed and return execution id', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('execution_id');
                });
            });
            describe('/exec/stored', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");

                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw pipeline not found', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "not_found"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_found Not Found");
                });
                it('should succeed and return execution id', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "flow1"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('execution_id');
                });
            });
            describe('/exec/stop', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'GET',
                        uri: restUrl + '/exec/stop',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": 'no_such_id' }
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal('execution_id no_such_id Not Found');
                });
                it('should succeed to stop', async function () {
                    const optionsStored = {
                        uri: restUrl + '/exec/stored',
                        body: { "name": "flow1" }
                    }
                    const stored = await _request(optionsStored);
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": stored.body.execution_id }
                    }
                    const response = await _request(optionsStop);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
            describe('/exec/status', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/status',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw status Not Found with params', async function () {
                    const options = {
                        uri: restUrl + '/exec/status/no_such_id',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("status no_such_id Not Found");
                });
                it('should throw validation error of required property execution id', async function () {
                    const options = {
                        uri: restUrl + '/exec/status',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
                it('should succeed to get status', async function () {
                    const optionsRun = {
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        body: {
                            "name": "flow1"
                        }
                    }
                    const responseRun = await _request(optionsRun);

                    const options = {
                        uri: restUrl + `/exec/status/${responseRun.body.execution_id}`,
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(200);
                    expect(response.body).to.have.property('data');
                    expect(response.body).to.have.property('execution_id');
                    expect(response.body).to.have.property('timestamp');
                });
            });
            describe('/exec/results', function () {
                it('should throw Method Not Allowed', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/results',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(405);
                    expect(response.body.error.message).to.equal("Method Not Allowed");
                });
                it('should throw status Not Found with params', async function () {
                    const options = {
                        uri: restUrl + '/exec/results/no_such_id',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("results no_such_id Not Found");
                });
                it('should throw validation error of required property execution id', async function () {
                    const options = {
                        uri: restUrl + '/exec/results',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'execution_id'");
                });
            });
        });
        describe('Store', function () {
            describe('/store/pipelines:name GET', function () {
                it('should throw error pipeline not found', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_exists Not Found");
                });
                it('should return specific pipeline', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow1',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.deep.equal(pipelines[0]);
                });
            });
            describe('/store/pipelines:name DELETE', function () {
                it('should throw error pipeline not found', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/not_exists',
                        method: 'DELETE',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(404);
                    expect(response.body.error.message).to.equal("pipeline not_exists Not Found");
                });
                it('should delete specific pipeline', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines/flow3',
                        method: 'DELETE',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal("OK");
                });
            });
            describe('/store/pipelines GET', function () {
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'GET'
                    }
                    const response = await _request(options);
                    expect(response.body).to.be.an('array');
                });
            });
            describe('/store/pipelines POST', function () {
                it('should throw validation error of required property name', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {}
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'name'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": {}
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should be string");
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": ""
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                });
                it('should throw validation error of required property nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string"
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'nodes'");
                });
                it('should throw validation error of required property nodes.nodeName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "algorithmName": "green-alg",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                });
                it('should throw validation error of required property nodes.algorithmName', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "input": [
                                        {}
                                    ]
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                });
                it('should throw validation error of nodes.algorithmName one of the allowed values', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "string",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.nodes[0].algorithmName should be equal to one of the allowed values");
                });
                it('should throw validation error of nodes.input should be array', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": null
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"

                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                });
                it('should throw validation error of required property webhooks', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ]
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should have required property 'webhooks'");

                });
                it('should throw validation error of required property webhooks.result', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'result'");
                });
                it('should throw validation error of required property webhooks.progress', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data.webhooks should have required property 'progress'");
                });
                it('should throw validation error of data should NOT have additional properties', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/store/pipelines',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "string",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            },
                            "additionalProps": {
                                "bla": 60,
                                "blabla": "info"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal("data should NOT have additional properties");
                });
                it('should throw conflict error', async function () {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = 'flow1';
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(409);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.message).to.equal('pipeline flow1 already exists');
                });
                it('should succeed to store pipeline', async function () {
                    const pipeline = clone(pipelines[0]);
                    pipeline.name = uuidv4();
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'POST',
                        body: pipeline
                    }
                    const response = await _request(options);
                    expect(response.response.statusCode).to.equal(201);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
                it('should throw validation error of duplicate nodes', async function () {
                    const options = {
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        body: {
                            "name": "string",
                            "nodes": [
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                },
                                {
                                    "nodeName": "dup",
                                    "algorithmName": "green-alg",
                                    "input": []
                                }
                            ],
                            "webhooks": {
                                "progress": "string",
                                "result": "string"
                            }
                        }
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(400);
                    expect(response.body.error.message).to.equal('found duplicate nodes dup');
                });
            });
            describe('/store/pipelines PUT', function () {
                it('should throw validation error of required property execution_id', async function () {
                    const options = {
                        uri: restUrl + '/store/pipelines',
                        method: 'PUT',
                        body: pipelines[0]
                    }
                    const response = await _request(options);
                    expect(response.body).to.have.property('message');
                    expect(response.body.message).to.equal('OK');
                });
            });
        });
        describe('Webhooks', function () {
            describe('Results', function () {
            });
            describe('Progress', function () {
                it('should succeed to post a webhook', async function () {
                    let execution_id = null;
                    webhookStub.on('progress', async (request) => {
                        if (request.body.execution_id === execution_id) {
                            expect(request.body).to.have.property('data');
                            expect(request.body).to.have.property('execution_id');
                            expect(request.body).to.have.property('timestamp');

                            const status = {
                                uri: restUrl + `/exec/status/${execution_id}`,
                                method: 'GET'
                            }
                            const responseStatus = await _request(status);
                            expect(request.body).to.deep.equal(responseStatus.body);
                        }
                    })
                    const stored = {
                        uri: restUrl + '/exec/stored',
                        body: { "name": "webhookFlow" }
                    }
                    const response = await _request(stored);
                    execution_id = response.body.execution_id;
                });
            });
        });
    });
});

