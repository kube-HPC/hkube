const clone = require('clone');
const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const { uuid } = require('@hkube/uid');
const querystring = require('querystring');
const { pipelines, workerStub } = require('./mocks');
const { request, delay } = require('./utils');
let restUrl, internalUrl;

describe('Internal', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        internalUrl = global.testParams.internalUrl;
    });
    it('should clean the job', async () => {
        const options1 = {
            uri: `${restUrl}/exec/raw`,
            body: {
                name: 'clean',
                nodes: [
                    {
                        nodeName: 'string',
                        algorithmName: 'green-alg'
                    }
                ]
            }
        };
        const response1 = await request(options1);
        const { jobId } = response1.body;

        const options2 = {
            uri: `${internalUrl}/exec/clean`,
            body: { jobId }
        };
        const response2 = await request(options2);
        expect(response2.body.message).to.equal('OK');
    });
    it('should succeed to stop', async () => {
        const optionsStored = {
            uri: restUrl + '/exec/stored',
            body: { name: 'flow1' }
        };
        const stored = await request(optionsStored);
        const optionsStop = {
            uri: `${internalUrl}/exec/stop`,
            body: { jobId: stored.body.jobId }
        };
        const response = await request(optionsStop);
        expect(response.body).to.have.property('message');
        expect(response.body.message).to.equal('OK');
    });
    describe('Cron', () => {
        it('should run cron pipelines with experiment', async () => {
            const pipelineName = 'cron-test-experiment';
            const options1 = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: pipelineName,
                    experimentName: 'my-new-experiment',
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName: 'green-alg',
                            input: ['flowInput']
                        }
                    ]
                }
            };
            await request(options1);

            const options2 = {
                uri: `${internalUrl}/exec/stored/cron`,
                body: {
                    name: pipelineName
                }
            };
            const response = await request(options2);
            expect(response.body.jobId).to.not.include(pipelineName);
        })
        it('should run cron pipelines without experiment', async () => {
            const pipeline = clone(pipelines[0]);
            const options = {
                uri: `${internalUrl}/exec/stored/cron`,
                body: {
                    name: pipeline.name
                }
            };
            const response = await request(options);
            expect(response.body.jobId).to.not.include(pipeline.name);
        })
        it('should run triggered cron pipelines and get the results', async () => {
            const requests = 5;
            const limit = 3;
            const pipeline = 'cron-test';
            const results = [];
            const options = {
                uri: restUrl + '/store/pipelines',
                body: {
                    name: pipeline,
                    nodes: [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "@flowInput"
                            ]
                        }
                    ],
                    flowInput: {
                        "files": {
                            "link": "links-1"
                        }
                    }
                }
            };
            await request(options);

            // run the rest of the triggered pipelines
            for (let i = 0; i < requests; i++) {
                const options = {
                    uri: `${internalUrl}/exec/stored/cron`,
                    body: {
                        name: pipeline
                    }
                };
                const res = await request(options);
                await workerStub.done({ jobId: res.body.jobId, data: i });
                results.push(res.body.jobId);
            }

            // get the cron results
            const qs = querystring.stringify({ name: pipeline, sort: 'desc', limit });
            const opt = {
                uri: restUrl + `/cron/results/?${qs}`,
                method: 'GET'
            };
            const response = await request(opt);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body).to.have.lengthOf(limit);
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('data');
            expect(response.body[0]).to.have.property('storageModule');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timeTook');
            expect(response.body[0]).to.have.property('timestamp');
        });
    });
    describe('Triggers', () => {
        it('should throw error when invalid pipeline name', async () => {
            const options = {
                uri: `${internalUrl}/exec/stored/trigger`
            };
            const response = await request(options);
            expect(response.body.error.message).to.equal(`data should have required property 'name'`);
        });
        it('should run stored pipeline and update rootJobId and types', async () => {
            const options1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: 'flow1'
                }
            };
            const res1 = await request(options1);
            const jobId = res1.body.jobId;
            const options2 = {
                uri: `${internalUrl}/exec/stored/trigger`,
                body: {
                    name: 'flow2',
                    parentJobId: jobId
                }
            };
            const res2 = await request(options2);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res2.body.jobId}`,
                method: 'GET'
            };
            const res3 = await request(optionsGET);
            expect(res3.body.rootJobId).to.eql(jobId);
            expect(res3.body.types).to.eql([pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.TRIGGER]);
        });
        it('should run stored trigger pipeline and merge parent flowInput', async () => {
            const flow2 = pipelines.find(p => p.name === 'flow2')
            const options1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: 'flow1'
                }
            };
            const res1 = await request(options1);
            const jobId = res1.body.jobId;
            const data = { prop: 42 };
            await workerStub.done({ jobId, data });
            await delay(500)
            const options2 = {
                uri: `${internalUrl}/exec/stored/trigger`,
                body: {
                    name: 'flow2',
                    parentJobId: jobId
                }
            };
            const res2 = await request(options2);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res2.body.jobId}`,
                method: 'GET'
            };
            const res3 = await request(optionsGET);
            expect(res3.body.flowInput).to.eql({ ...flow2.flowInput, parent: data });
        });
        it('should succeed without reaching too many request', async () => {
            const requests = 10;
            const promises = [];
            const pipeline = 'flow1';
            const options1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: 'flow1'
                }
            };
            const res1 = await request(options1);
            const jobId = res1.body.jobId;
            for (let i = 0; i < requests; i++) {
                const options = {
                    uri: `${internalUrl}/exec/stored/trigger`,
                    body: {
                        name: pipeline,
                        parentJobId: jobId
                    }
                };
                promises.push(request(options));
            }
            const response = await Promise.all(promises);
            const jobs = response.map(r => r.body.jobId);
            expect(jobs).to.have.lengthOf(requests);
            expect(jobs.every(j => typeof j === 'string')).to.equal(true);
        });
        it('should run triggered pipelines and the executions tree', async function () {
            const requests = 5;
            const pipeline = 'trigger-test';
            const results = [];

            // insert 10 triggered pipelines
            for (let i = 1; i < requests; i++) {
                const body = {
                    name: `${pipeline}-${i}`,
                    nodes: [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "@flowInput"
                            ]
                        }
                    ],
                    flowInput: {
                        files: {
                            link: "links-1"
                        }
                    },
                    triggers: {
                        pipelines: [
                            `${pipeline}-${(i + 1)}`
                        ]
                    }
                }
                const options = {
                    uri: restUrl + '/store/pipelines',
                    body
                };
                await request(options);
            }

            // run the first pipeline
            const options = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: `${pipeline}-${1}`
                }
            };

            const response = await request(options);
            const firstJobId = response.body.jobId;
            let jobId = response.body.jobId
            results.push(jobId);

            // run the rest of the triggered pipelines
            for (let i = 1; i < requests; i++) {
                const name = `${pipeline}-${(i + 1)}`;
                const options = {
                    uri: `${internalUrl}/exec/stored/trigger`,
                    body: {
                        name,
                        parentJobId: jobId
                    }
                };
                const res = await request(options);
                jobId = res.body.jobId
                results.push(jobId);
            }

            // get the exec tree
            const opt = {
                uri: `${restUrl}/exec/tree/${firstJobId}`,
                method: 'GET'
            };
            const tree = await request(opt);
            expect(tree.body).to.have.property('children');
            expect(tree.body).to.have.property('jobId');
            expect(tree.body).to.have.property('name');
        });
        it('should failed if jobId not found', async () => {
            const options = {
                method: 'GET',
                uri: restUrl + `/exec/tree/${uuid()}`
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
        });
    });
    describe('SubPipeline', () => {
        it('should run stored subPipeline', async function () {
            const pipeline = clone(pipelines[0]);
            const options1 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: pipeline.name
                }
            };
            const response1 = await request(options1);
            const flowInput = {
                data: 33
            };
            const options2 = {
                uri: `${internalUrl}/exec/stored/subPipeline`,
                body: {
                    name: pipeline.name,
                    jobId: response1.body.jobId,
                    taskId: `taskId:${uuid()}`,
                    flowInput
                }
            };
            const response2 = await request(options2);

            const options3 = {
                uri: `${restUrl}/exec/pipelines/${response2.body.jobId}`,
                method: 'GET'
            };
            const response3 = await request(options3);
            expect(response2.body).to.have.property('jobId');
            expect(response3.body.flowInput).to.eql({ ...pipeline.flowInput, ...flowInput });
        });
        it('should run stored subPipeline and update right types', async function () {
            const pipeline = clone(pipelines[0]);
            const options = {
                uri: `${internalUrl}/exec/stored/subPipeline`,
                body: {
                    name: pipeline.name,
                    jobId: `jobId - ${uuid()} `,
                    taskId: `taskId - ${uuid()} `
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.INTERNAL, pipelineTypes.STORED, pipelineTypes.SUB_PIPELINE]);
        });
        it('should run raw subPipeline', async function () {
            const pipeline = clone(pipelines[0]);
            const options = {
                uri: `${internalUrl}/exec/raw/subPipeline`,
                body: {
                    name: pipeline.name,
                    nodes: [
                        {
                            nodeName: "green",
                            algorithmName: "green-alg",
                            input: [
                                "data"
                            ]
                        }
                    ],
                    jobId: `jobId-${uuid()}`,
                    taskId: `taskId-${uuid()}`
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should run raw subPipeline and update right types', async function () {
            const pipeline = clone(pipelines[0]);
            const options = {
                uri: `${internalUrl}/exec/raw/subPipeline`,
                body: {
                    name: pipeline.name,
                    nodes: [
                        {
                            nodeName: "green",
                            algorithmName: "green-alg",
                            input: [
                                "data"
                            ]
                        }
                    ],
                    jobId: `jobId-${uuid()}`,
                    taskId: `taskId-${uuid()}`
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.INTERNAL, pipelineTypes.RAW, pipelineTypes.SUB_PIPELINE]);
        });
    });
});
