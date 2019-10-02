const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const stateManager = require('../lib/state/state-manager');
const { pipelines, triggersTree, workerStub } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                method: 'GET',
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
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
            expect(response.body.error.code).to.equal(400);
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
            expect(response.body.error.code).to.equal(400);
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
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'nodes'");
        });
        it('should throw validation error of required property nodes.nodeName', async () => {
            const options = {
                uri: restPath,
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
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'nodeName'");
        });
        it('should throw validation error of required property nodes.algorithmName', async () => {
            const options = {
                uri: restPath,
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
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data.nodes[0] should have required property 'algorithmName'");
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
            expect(response.body.error.code).to.equal(400);
        });
        it('should throw validation error of data should NOT have additional properties', async () => {
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
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('data should NOT have additional properties');
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
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('found duplicate node dup');
        });
        it('should throw validation error priority range', async () => {
            const options = {
                uri: restPath,
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
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('data.priority should be <= 5');
        });
        const invalidStartAndEndChars = ['/', '*', '#', '"', '%'];
        invalidStartAndEndChars.forEach((v) => {
            it(`should throw validation error pipeline name include ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `exec${v}raw`,
                        nodes: [
                            {
                                nodeName: 'string',
                                algorithmName: 'green-alg',
                                input: []
                            }
                        ]
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(400);
                expect(response.body.error.message).to.equal('pipeline name must contain only alphanumeric, dash, dot or underscore');
            });
            it(`should throw validation error pipeline name start with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `${v}xecraw`,
                        nodes: [
                            {
                                nodeName: 'string',
                                algorithmName: 'green-alg',
                                input: []
                            }
                        ]
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(400);
                expect(response.body.error.message).to.equal('pipeline name must contain only alphanumeric, dash, dot or underscore');
            });
        });
        it('should succeed and return job id', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
    });
    describe('/exec/stored', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stored`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                method: 'GET',
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
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
            expect(response.body.error.code).to.equal(400);
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
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw validation error of data should NOT have additional properties', async () => {
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
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('data should NOT have additional properties');
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
            expect(response.body.error.code).to.equal(404);
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
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal('pipeline name must contain only alphanumeric, dash, dot or underscore');
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
    });
    describe('/exec/stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stop`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                method: 'GET',
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw validation error of required property jobId', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: { jobId: 'no_such_id' }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
        });
        it('should succeed to stop', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const stored = await request(optionsStored);
            const optionsStop = {
                uri: restPath,
                body: { jobId: stored.body.jobId }
            };
            const response = await request(optionsStop);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal('OK');
        });
    });
    describe('/exec/status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/status`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('status no_such_id Not Found');
        });
        it('should throw validation error of required property execution id', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should succeed to get status', async () => {
            const optionsRun = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: 'flow1'
                }
            };
            const responseRun = await request(optionsRun);
            const options = {
                uri: restPath + `/${responseRun.body.jobId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(200);
            expect(response.body).to.have.property('jobId');
            expect(response.body).to.have.property('level');
            expect(response.body).to.have.property('pipeline');
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('timestamp');
        });
    });
    describe('/exec/results', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/results`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(404);
            expect(response.body.error.message).to.equal('status no_such_id Not Found');
        });
        it('should throw validation error of required property execution id', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(400);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should succeed to get results', async () => {
            const optionsRun = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'exec_raw_results',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const responseRun = await request(optionsRun);
            const jobId = responseRun.body.jobId;
            const data = 500;
            await workerStub.done({ jobId, data });

            const options = {
                uri: restPath + `/${responseRun.body.jobId}`,
                method: 'GET'
            };
            const response = await request(options);

            expect(response.response.statusCode).to.equal(200);
            expect(response.body.data).to.equal(data);
            expect(response.body).to.have.property('jobId');
            expect(response.body).to.have.property('data');
            expect(response.body).to.have.property('storageModule');
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('timeTook');
            expect(response.body).to.have.property('timestamp');
        });
    });
    describe('/exec/tree', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/tree`;
        });
        it('pipeline call stack by trigger', async () => {
            let prefix = '57ec5c39-122b-4d7c-bc8f-580ba30df511';
            await Promise.all([
                stateManager.setJobStatus({ jobId: prefix + '.a', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.e', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.e.f', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.g', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.i', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.l', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.o', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.p', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.m', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.n', data: { startTime: Date.now() } })
            ]);

            const options = {
                method: 'GET',
                uri: restPath + `/${prefix}.a`
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(triggersTree);
        });
        it('should failed if jobId not found', async () => {
            const options = {
                method: 'GET',
                uri: restPath + `/${uuidv4()}`
            };
            const response = await request(options);
            expect(response.response.statusCode).to.deep.equal(404);
        });
    });
    describe('/exec/pipelines', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/pipelines`;
        });
        it('should throw Method Not Allowed', async () => {
            const options = {
                uri: restPath + '/job',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(405);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                method: 'GET',
                uri: restPath + '/not_exists',
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(404);
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
            expect(response.body.error.code).to.equal(404);
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
                            input: []
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
            const rp = await stateManager.getRunningPipelines({ jobId: 'concurrentPipelines:' });
            await Promise.all(rp.map(p => stateManager.deleteRunningPipeline({ jobId: p.jobId })));
            const pipeline = pipelines.find(p => p.name === 'concurrentPipelines');

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
            expect(response2.body.error.message).to.equal(`maximum number [${pipeline.options.concurrentPipelines}] of concurrent pipelines has been reached`);

        });
    });
});
