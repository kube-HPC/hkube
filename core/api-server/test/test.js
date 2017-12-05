process.env.NODE_PATH = process.cwd();
require('module').Module._initPaths();

const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('request');
const bootstrap = require('../bootstrap');
let restUrl;

function requestPromise(options) {
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
            return resolve(body);
        });
    })
}

describe('Test', function () {
    before(async () => {
        const config = await bootstrap.init();
        restUrl = config.swagger.protocol + '://' + config.swagger.host + ':' + config.swagger.port + config.swagger.path
    })
    describe('Rest-API', function () {
        describe('Execution', function () {
            describe('/exec/raw', function () {
                it('should throw validation error of required property name', function (done) {
                    const body = {};
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should have required property 'name'");
                        done();
                    });
                });
                it('should throw validation error of data.name should be string', function (done) {
                    const body = {
                        "name": {}
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.name should be string");
                        done();
                    });
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', function (done) {
                    const body = {
                        "name": ""
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                        done();
                    });
                });
                it('should throw validation error of required property nodes', function (done) {
                    const body = {
                        "name": "string"
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should have required property 'nodes'");
                        done();
                    });
                });
                it('should throw validation error of required property nodes.nodeName', function (done) {
                    const body = {
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
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
                        done();
                    });
                });
                it('should throw validation error of required property nodes.algorithmName', function (done) {
                    const body = {
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
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
                        done();
                    });
                });
                it('should throw validation error of nodes.algorithmName one of the allowed values', function (done) {
                    const body = {
                        "name": "string",
                        "nodes": [
                            {
                                "nodeName": "string",
                                "algorithmName": "string",
                                "input": []
                            }
                        ]
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.nodes[0].algorithmName should be equal to one of the allowed values");
                        done();
                    });
                });
                it('should throw validation error of nodes.input should be array', function (done) {
                    const body = {
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
                            "complete": "string"

                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.nodes[0].input should be array");
                        done();
                    });
                });
                it('should throw validation error of required property webhooks', function (done) {
                    const body = {
                        "name": "string",
                        "nodes": [
                            {
                                "nodeName": "string",
                                "algorithmName": "green-alg",
                                "input": []
                            }
                        ]
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should have required property 'webhooks'");
                        done();
                    });
                });
                it('should throw validation error of required property webhooks.complete', function (done) {
                    const body = {
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
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.webhooks should have required property 'complete'");
                        done();
                    });
                });
                it('should throw validation error of required property webhooks.progress', function (done) {
                    const body = {
                        "name": "string",
                        "nodes": [
                            {
                                "nodeName": "string",
                                "algorithmName": "green-alg",
                                "input": []
                            }
                        ],
                        "webhooks": {
                            "complete": "string"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.webhooks should have required property 'progress'");
                        done();
                    });
                });
                it('should throw validation error of data should NOT have additional properties', function (done) {
                    const body = {
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
                            "complete": "string"
                        },
                        "additionalProps": {
                            "bla": 60,
                            "blabla": "info"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should NOT have additional properties");
                        done();
                    });
                });
                it('should succeed and return execution id', function (done) {
                    const body = {
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
                            "complete": "string"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/raw',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('execution_id');
                        done();
                    });
                });
            });
            describe('/exec/stored', function () {
                it('should throw validation error of required property name', function (done) {
                    const body = {}
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should have required property 'name'");
                        done();
                    });
                });
                it('should throw validation error of data.name should be string', function (done) {
                    const body = {
                        "name": {}
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.name should be string");
                        done();
                    });
                });
                it('should throw validation error of name should NOT be shorter than 1 characters"', function (done) {
                    const body = {
                        "name": ""
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.name should NOT be shorter than 1 characters");
                        done();
                    });
                });
                it('should throw validation error of required property webhooks.complete', function (done) {
                    const body = {
                        "name": "string",
                        "webhooks": {
                            "progress": "string"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.webhooks should have required property 'complete'");
                        done();
                    });
                });
                it('should throw validation error of required property webhooks.progress', function (done) {
                    const body = {
                        "name": "string",
                        "webhooks": {
                            "complete": "string"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data.webhooks should have required property 'progress'");
                        done();
                    });
                });
                it('should throw validation error of data should NOT have additional properties', function (done) {
                    const body = {
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
                            "complete": "string"
                        }
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(400);
                        expect(body.error.message).to.equal("data should NOT have additional properties");
                        done();
                    });
                });
                it('should throw pipeline not found', function (done) {
                    const body = {
                        "name": "not_found"
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('error');
                        expect(body.error.code).to.equal(404);
                        expect(body.error.message).to.equal("pipeline not_found Not Found");
                        done();
                    });
                });
                it('should succeed and return execution id', function (done) {
                    const body = {
                        "name": "myFlow"
                    }
                    request({
                        method: 'POST',
                        uri: restUrl + '/exec/stored',
                        json: true,
                        body: body
                    }, (error, response, body) => {
                        expect(body).to.have.property('execution_id');
                        done();
                    });
                });
            });
            describe('/exec/stop', function () {
                it('should throw validation error of required property execution_id', async function () {
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: {}
                    }
                    const stopResponse = await requestPromise(optionsStop);
                    expect(stopResponse.error.code).to.equal(400);
                    expect(stopResponse.error.message).to.equal("data should have required property 'execution_id'");
                });
                it('should throw validation error of data.name should be string', async function () {
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": 'no_such_id' }
                    }
                    const stopResponse = await requestPromise(optionsStop);
                    expect(stopResponse.error.code).to.equal(404);
                    expect(stopResponse.error.message).to.equal('execution_id no_such_id Not Found');
                });
                it('should succeed to stop', async function () {
                    const optionsStored = {
                        uri: restUrl + '/exec/stored',
                        body: { "name": "myFlow" }
                    }
                    const stored = await requestPromise(optionsStored);
                    const optionsStop = {
                        uri: restUrl + '/exec/stop',
                        body: { "execution_id": stored.execution_id }
                    }
                    const stopResponse = await requestPromise(optionsStop);
                    expect(stopResponse).to.have.property('message');
                    expect(stopResponse.message).to.equal('OK');
                });
            });
            describe('/exec/status', function () {
            });
            describe('/exec/results', function () {
            });
        });
    });
    describe('Store', function () {
        describe('/store/pipelines:name GET', function () {
        });
        describe('/store/pipelines:name DELETE', function () {
        });
        describe('/store/pipelines GET', function () {
        });
        describe('/store/pipelines POST', function () {
        });
        describe('/store/pipelines PUT', function () {
        });
    });
});

