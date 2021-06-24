const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { uid } = require('@hkube/uid');
const { request } = require('./utils');
const gatewayService = require('../lib/service/gateway');
let restUrl;
const nodes = [
    {
        nodeName: 'A',
        algorithmName: 'green-alg',
        input: [],
        stateType: 'stateful'
    },
    {
        nodeName: 'B',
        algorithmName: 'green-alg',
        input: []
    },
    {
        nodeName: 'C',
        algorithmName: 'green-alg',
        input: []
    },
    {
        nodeName: 'D',
        algorithmName: 'green-alg',
        input: [],
        stateType: 'stateful'
    }
];

describe('Streaming', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/streaming/exec/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw invalid node in stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> Z'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('invalid node Z in stream flow analyze');
        });
        it('should throw invalid stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: null
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('invalid stream flow analyze');
        });
        it('should throw not valid flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('stream flow analyze should have valid flow, example: A >> B');
        });
        it('should throw not valid flow format', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A --> B'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('stream flow analyze should have valid flow, example: A >> B');
        });
        it('should throw stream flow only allowed in stream pipeline', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'batch',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('streaming flow is only allowed in stream pipeline');
        });
        it('should throw specify default stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze1: 'A >> B >> C >> D >> B >> A',
                            analyze2: 'A >> B&C >> D',
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('please specify a default stream flow');
        });
        it('should throw duplicate flow relation found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> B >> C >> A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('duplicate relation found A >> B in flow analyze');
        });
        it('should throw invalid relation found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> A'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('invalid relation found A >> A in flow analyze');
        });
        it('should not throw invalid relation found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> B >> C >> B >> A'
                        }
                    }
                }
            };
            const res = await request(options);
            expect(res.body).to.have.property('jobId');
        });
        it('should succeed to execute with customStream edge type', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes,
                    streaming: {
                        flows: {
                            analyze: 'A >> B >> C >> D'
                        }
                    }
                }
            };
            const re = await request(options);
            const optionsGET = { uri: `${restUrl}/exec/pipelines/${re.body.jobId}`, method: 'GET' };
            const res = await request(optionsGET);
            const flows = Object.keys(res.body.streaming.flows);
            const parsedFlow = Object.keys(res.body.streaming.parsedFlow);
            expect(res.body.edges).to.have.lengthOf(3);
            expect(flows).to.eql(parsedFlow);
            expect(res.body.edges[0].types[0]).to.eql('customStream');
            expect(res.body.edges[1].types[0]).to.eql('customStream');
        });
        it('should succeed to execute with stream flow', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-flow',
                    kind: 'stream',
                    nodes: [
                        {
                            nodeName: 'A',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateful'
                        },
                        {
                            nodeName: 'B',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'C',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'D',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        },
                        {
                            nodeName: 'E',
                            algorithmName: 'green-alg',
                            input: [],
                            stateType: 'stateless'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze0: 'A >> B >> C >> D >> B >> A',
                            analyze1: 'A >> B&C >> D',
                            analyze2: 'A >> B&C >> D',
                            analyze3: 'A >> B >> C >> D >> A',
                            analyze4: 'A >> B&C&D >> E'
                        },
                        defaultFlow: 'analyze3'
                    }
                }
            };
            const re = await request(options);
            const optionsGET = { uri: `${restUrl}/exec/pipelines/${re.body.jobId}`, method: 'GET' };
            const res = await request(optionsGET);
            const flows = Object.keys(res.body.streaming.flows);
            const parsedFlow = Object.keys(res.body.streaming.parsedFlow);
            expect(res.body.edges).to.have.lengthOf(12);
            expect(flows).to.eql(parsedFlow);
        });
    });
    describe('/streaming/exec/stored', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stored`;
        });
        it('should throw entry node cannot be stateless', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-fail'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('entry node "A" cannot be stateless on stream pipeline');
        });
        it('should succeed to run stored streaming', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'streaming-success'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
    });
    describe('/streaming/gateways', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it.only('should throw duplicate gateway nodes', async () => {
            const name = `gate-name-${uid()}`;
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: { name }
                        },
                        {
                            nodeName: 'B',
                            kind: 'gateway',
                            spec: { name }
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain(`gateway ${name}-gateway already exists`);
        });
        it('should insert two gateway nodes', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway'
                        },
                        {
                            nodeName: 'B',
                            kind: 'gateway'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body.gateways).to.have.lengthOf(2);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[1].nodeName).to.eql(options.body.nodes[1].nodeName);
        });
        it('should insert gateway with spec', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'nodeA',
                            kind: 'gateway',
                            spec: { name: 'gate-name' }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'nodeA >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('gateways');
            expect(response.body.gateways.length).to.eql(1);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[0].url).to.eql(`hkube/gateway/${options.body.nodes[0].spec.name}`);
        });
        it('should insert gateway without spec', async () => {
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway'
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('gateways');
            expect(response.body.gateways.length).to.eql(1);
            expect(response.body.gateways[0].nodeName).to.eql(options.body.nodes[0].nodeName);
            expect(response.body.gateways[0].url).to.contains('hkube/gateway');
        });
        it('should delete gateway by jobId', async () => {
            const gatewayName = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: { name: gatewayName }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            const res1 = await request({ uri: `${restUrl}/gateway/${gatewayName}`, method: 'GET' });
            expect(res1.body.gatewayName).to.eql(gatewayName);
            await gatewayService.deleteAlgorithms({ jobId: res.body.jobId });
            const res2 = await request({ uri: `${restUrl}/gateway/${gatewayName}`, method: 'GET' });
            expect(res2.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res2.body.error.message).to.contain(`gateway ${gatewayName} Not Found`);
        });
        it('should insert gateway with full spec', async () => {
            const gateway = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: {
                                name: gateway,
                                description: 'my gateway',
                                mem: '1Gi'
                            }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            const res = await request(options);
            const response = await request({ uri: `${restUrl}/gateway/${gateway}`, method: 'GET' });
            expect(response.body.jobId).to.eql(res.body.jobId);
            expect(response.body.gatewayName).to.eql(gateway);
        });
        it('should get gateway list', async () => {
            const gatewayName = uid();
            const options = {
                uri: restPath,
                body: {
                    kind: 'stream',
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'A',
                            kind: 'gateway',
                            spec: {
                                name: gatewayName,
                                mem: '1Gi'
                            }
                        },
                        {
                            nodeName: 'B',
                            kind: 'algorithm',
                            algorithmName: 'green-alg'
                        }
                    ],
                    streaming: {
                        flows: {
                            analyze: 'A >> B'
                        }
                    }
                }
            };
            await request(options);
            const response = await request({ uri: `${restUrl}/gateway`, method: 'GET' });
            const gateway = response.body.find((g) => g.gatewayName === gatewayName);
            expect(response.body.length).to.gte(1);
            expect(gateway).to.exist;
        });
    });
    describe('/streaming/store', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/store/pipelines`;
        });
        it('should succeed to store flows streaming pipeline', async () => {
            const pipeline = {
                name: 'streaming-flow',
                experimentName: 'main',
                kind: 'stream',
                nodes: [
                    {
                        nodeName: 'A',
                        algorithmName: 'green-alg',
                        input: [],
                        stateType: 'stateful',
                        kind: 'algorithm'
                    },
                    {
                        nodeName: 'B',
                        algorithmName: 'green-alg',
                        input: [],
                        stateType: 'stateless',
                        kind: 'algorithm'
                    },
                    {
                        nodeName: 'C',
                        algorithmName: 'green-alg',
                        input: [],
                        stateType: 'stateless',
                        kind: 'algorithm'
                    },
                    {
                        nodeName: 'D',
                        algorithmName: 'green-alg',
                        input: [],
                        stateType: 'stateless',
                        kind: 'algorithm'
                    },
                    {
                        nodeName: 'E',
                        algorithmName: 'green-alg',
                        input: [],
                        stateType: 'stateless',
                        kind: 'algorithm'
                    }
                ],
                streaming: {
                    flows: {
                        analyze0: 'A >> B >> C >> D >> B >> A',
                        analyze1: 'A >> B&C >> D',
                        analyze2: 'A >> B&C >> D',
                        analyze3: 'A >> B >> C >> D >> A',
                        analyze4: 'A >> B&C&D >> E'
                    }
                },
                priority: 3,
                options: {
                    batchTolerance: 80,
                    progressVerbosityLevel: 'info',
                    ttl: 3600
                }
            };
            const options = {
                uri: restPath,
                body: pipeline
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal(pipeline);
        });
    });
});
