const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const pipeInPipe = require('./mocks/pipeline-in-pipeline.json');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        config = global.testParams.config;
    });
    describe('/exec/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
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
        it('should succeed to execute pipeline depend on pipeline', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            pipelineName: "pipeInPipe-1",
                            input: []
                        },
                        {
                            nodeName: "B",
                            pipelineName: "pipeInPipe-1",
                            input: [{ data: "@A" }]
                        }
                    ],
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.nodes).to.eql(pipeInPipe.nodes);
            expect(res2.body.edges).to.eql([{ source: "A-black", target: "B-green" }]);
        });
        it('should succeed to execute algorithm with pipelines', async () => {
            const options1 = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            pipelineName: "pipeInPipe-2",
                            input: [1, 2, false]
                        },
                        {
                            nodeName: "B",
                            pipelineName: "pipeInPipe-2",
                            input: [1, 2, false]
                        },
                        {
                            nodeName: "C",
                            pipelineName: "pipeInPipe-1",
                            input: [{ first: "@A", second: "@B" }]
                        },
                        {
                            nodeName: "D",
                            algorithmName: "eval-alg",
                            input: [{ first: "@B", second: "@C" }]
                        }
                    ],
                }
            };
            const res1 = await request(options1);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
            expect(res2.body.edges).to.eql([
                { source: "A-black", target: "C-green" },
                { source: "A-eval", target: "C-green" },
                { source: "B-black", target: "C-green" },
                { source: "B-eval", target: "C-green" },
                { source: "B-black", target: "D" },
                { source: "B-eval", target: "D" },
                { source: "C-black", target: "D" },
            ]);
        });
        it('should succeed to execute pipeline with algorithms', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            algorithmName: "eval-alg",
                            input: [1, 2, false]
                        },
                        {
                            nodeName: "B",
                            algorithmName: "eval-alg",
                            input: ["@A"]
                        },
                        {
                            nodeName: "C",
                            algorithmName: "eval-alg",
                            input: ["@B"]
                        },
                        {
                            nodeName: "D",
                            pipelineName: "pipeInPipe-1",
                            input: [1, 2, false]
                        }
                    ],
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
        });
        it('should succeed to execute pipeline of pipelines', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            pipelineName: "pipeInPipe-1",
                        },
                        {
                            nodeName: "B",
                            pipelineName: "pipeInPipe-1",
                        },
                        {
                            nodeName: "C",
                            pipelineName: "pipeInPipe-1",
                        },
                        {
                            nodeName: "D",
                            pipelineName: "pipeInPipe-1",
                        },
                        {
                            nodeName: "E",
                            pipelineName: "pipeInPipe-2",
                        },
                    ],
                    flowInput: {
                        data: {
                            link: "links-1"
                        },
                        files: {
                            newLink: "links-1"
                        }
                    }
                }
            };
            const res1 = await request(options);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
        });
        it('should succeed to execute pipeline not depend on pipeline', async () => {
            const options3 = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            pipelineName: "pipeInPipe-1",
                            input: []
                        },
                        {
                            nodeName: "B",
                            pipelineName: "pipeInPipe-1",
                            input: []
                        }
                    ],
                }
            };
            const res1 = await request(options3);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
        });
        it('should succeed to execute pipeline not depend on pipeline', async () => {
            const options3 = {
                uri: restPath,
                body: {
                    name: "pipeline_in_pipeline",
                    nodes: [
                        {
                            nodeName: "A",
                            pipelineName: "pipeInPipe-3",
                            input: []
                        },
                        {
                            nodeName: "B",
                            pipelineName: "pipeInPipe-3",
                            input: ["@A"]
                        }
                    ]
                }
            };
            const res1 = await request(options3);
            const optionsGET = {
                uri: `${restUrl}/exec/pipelines/${res1.body.jobId}`,
                method: 'GET'
            };
            const res2 = await request(optionsGET);
            expect(res2.body.types).to.eql([pipelineTypes.RAW]);
            expect(res2.body.edges).to.eql([
                { source: "A-green", target: "B-green" },
                { source: "A-green", target: "B-yellow" },
                { source: "A-yellow", target: "B-green" },
                { source: "A-yellow", target: "B-yellow" }

            ]);
        });
    });
});