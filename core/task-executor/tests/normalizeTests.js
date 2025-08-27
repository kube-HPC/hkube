const { expect } = require('chai');
const { normalizeWorkers, normalizeRequests, normalizeJobs, attacheJobToWorker, normalizeResources, normalizeHotRequests, normalizeColdWorkers } = require('../lib/reconcile/normalize');
const { twoCompleted, workersStub, jobsStub, resources } = require('./stub');
const { nodes, pods } = resources;
let { templateStore } = require('./stub');
const { stateType } = require('@hkube/consts');
const utils = require('../lib/utils/utils');
const { settings: globalSettings } = require('../lib/helpers/settings');
templateStore = templateStore.map(t => ({ ...t, minHotWorkers: 10 }));
const algorithmTemplates = utils.arrayToMap(templateStore);

describe('normalize', () => {
    describe('normalize jobs', () => {
        it('should work with no jobs', () => {
            const jobsRaw = {};
            const res = normalizeJobs(jobsRaw);
            expect(res).to.be.empty;
        });

        it('should work with undefined', () => {
            const res = normalizeJobs();
            expect(res).to.be.empty;
        });

        it('should ignore completed jobs', () => {
            const res = normalizeJobs(twoCompleted, null, j => !j.status.succeeded);
            expect(res).to.have.lengthOf(2);
        });

        it('should ignore active jobs', () => {
            const res = normalizeJobs(twoCompleted, null, j => j.status.succeeded);
            expect(res).to.have.lengthOf(2);
        });

        it('should ignore completed and failed jobs', () => {
            const res = normalizeJobs(twoCompleted, null, j => (!j.status.succeeded && !j.status.failed));
            expect(res).to.have.lengthOf(1);
        });

        it('should return all jobs', () => {
            const res = normalizeJobs(twoCompleted);
            expect(res).to.have.lengthOf(4);
        });
    });

    describe('normalize workers', () => {
        it('should work with empty worker array', () => {
            const workers = [];
            const res = normalizeWorkers(workers);
            expect(res).to.be.empty;
        });

        it('should work with undefined worker array', () => {
            const res = normalizeWorkers();
            expect(res).to.be.empty;
        });

        it('should return object with ids', () => {
            const workers = [
                {
                    workerId: 'id1',
                    algorithmName: 'green-alg',
                    workerStatus: 'ready',
                    hotWorker: false,
                    jobStatus: 'ready',
                    error: null
                },
                {
                    workerId: 'id2',
                    algorithmName: 'green-alg',
                    hotWorker: false,
                    workerStatus: 'not-ready',
                    jobStatus: 'ready',
                    error: null
                },
                {
                    workerId: 'id3',
                    algorithmName: 'red-alg',
                    hotWorker: false,
                    workerStatus: 'notready',
                    jobStatus: 'ready',
                    error: null
                }
            ];
            const res = normalizeWorkers(workers);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                id: 'id1',
                algorithmName: 'green-alg',
                hotWorker: false,
                workerStatus: 'ready',
                workerPaused: false,
                podName: undefined,
                workerImage: undefined,
                algorithmImage: undefined,
                algorithmVersion: undefined
            });
            expect(res).to.deep.include({
                id: 'id2',
                algorithmName: 'green-alg',
                hotWorker: false,
                workerStatus: 'not-ready',
                workerPaused: false,
                podName: undefined,
                workerImage: undefined,
                algorithmImage: undefined,
                algorithmVersion: undefined
            });
            expect(res).to.deep.include({
                id: 'id3',
                algorithmName: 'red-alg',
                hotWorker: false,
                workerStatus: 'notready',
                workerPaused: false,
                podName: undefined,
                workerImage: undefined,
                algorithmImage: undefined,
                algorithmVersion: undefined
            });
        });
    });

    describe('normalize hot workers', () => {
        it('should work with undefined', () => {
            const res = normalizeHotRequests();
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty data', () => {
            const normRequests = [];
            const algorithmTemplates = {};
            const res = normalizeHotRequests(normRequests, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty normRequests', () => {
            const normRequests = null;
            const algorithmTemplates = {};
            const res = normalizeHotRequests(normRequests, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty algorithmTemplates', () => {
            const normRequests = [];
            const algorithmTemplates = null;
            const res = normalizeHotRequests(normRequests, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });
    });

    describe('normalize cold workers', () => {
        it('should work with undefined', () => {
            const res = normalizeColdWorkers();
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty data', () => {
            const normWorkers = [];
            const algorithmTemplates = {};
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty normWorkers', () => {
            const normWorkers = null;
            const algorithmTemplates = {};
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should work with empty hotWorkers', () => {
            const normWorkers = [];
            const algorithmTemplates = null;
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should return full cold workers array', () => {
            const normWorkers = [
                {
                    "id": "1ed6407e-6700-4b06-ae0d-307483578074",
                    "algorithmName": "eval-alg",
                    "hotWorker": true
                },
                {
                    "id": "22fa61a6-bb1d-4412-8882-ed596e3f1a45",
                    "algorithmName": "eval-alg",
                    "hotWorker": true
                }
            ]
            const algorithmTemplates = {
                ['eval-alg']: {
                    name: 'eval-alg',
                    algorithmImage: 'hkube/algorunner',
                    cpu: 0.5,
                    mem: '256Mi',
                    minHotWorkers: 0
                }
            };
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(normWorkers.length);
        });

        it('should return empty array with high minHotWorkers', () => {
            const normWorkers = [
                {
                    "id": "1ed6407e-6700-4b06-ae0d-307483578074",
                    "algorithmName": "eval-alg",
                    "hotWorker": true
                },
                {
                    "id": "22fa61a6-bb1d-4412-8882-ed596e3f1a45",
                    "algorithmName": "eval-alg",
                    "hotWorker": true
                }
            ]
            const algorithmTemplates = {
                ['eval-alg']: {
                    name: 'eval-alg',
                    algorithmImage: 'hkube/algorunner',
                    cpu: 0.5,
                    mem: 256,
                    minHotWorkers: 5
                }
            };
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(0);
        });

        it('should return partial cold workers array', () => {
            const normWorkers = [
                {
                    "id": "1ed6407e-6700-4b06-ae0d-307483578074",
                    "algorithmName": "eval-alg",
                    "hotWorker": false
                },
                {
                    "id": "22fa61a6-bb1d-4412-8882-ed596e3f1a45",
                    "algorithmName": "eval-alg",
                    "hotWorker": true
                }
            ]
            const algorithmTemplates = {
                ['eval-alg']: {
                    name: 'eval-alg',
                    algorithmImage: 'hkube/algorunner',
                    cpu: 0.5,
                    mem: 256,
                    minHotWorkers: 0
                }
            };
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(normWorkers.length - 1);
        });

        it('should return empty cold workers array', () => {
            const normWorkers = [
                {
                    "id": "1ed6407e-6700-4b06-ae0d-307483578074",
                    "algorithmName": "eval-alg",
                    "hotWorker": false
                },
                {
                    "id": "22fa61a6-bb1d-4412-8882-ed596e3f1a45",
                    "algorithmName": "eval-alg",
                    "hotWorker": false
                }
            ]
            const algorithmTemplates = {};
            const res = normalizeColdWorkers(normWorkers, algorithmTemplates);
            expect(res).to.have.lengthOf(normWorkers.length - 2);
        });
    });

    describe('normalize requests', () => {
        it('should work with empty requests array', () => {
            const res = normalizeRequests([]);
            expect(res).to.be.empty;
        });

        it('should work with undefined requests array', () => {
            const res = normalizeRequests();
            expect(res).to.be.empty;
        });

        it('should return object with requests per algorithms', () => {
            const stub = [
                {
                    data: [
                        {
                            name: 'black-alg',
                        },
                        {
                            name: 'black-alg',
                        },
                        {
                            name: 'yellow-alg',
                        },
                        {
                            name: 'green-alg',
                        }

                    ]
                }
            ];
            const algorithmTemplateStore = {
                'yellow-alg':{},
                'green-alg':{},
                'black-alg':{},
            }
            const res = normalizeRequests(stub, algorithmTemplateStore);
            expect(res).to.have.length(4);
            expect(res).to.deep.include({
                algorithmName: 'black-alg',
                requestType: 'batch',
            });
            expect(res.filter(r => r.algorithmName === 'black-alg')).to.have.lengthOf(2);
            expect(res).to.deep.include({
                algorithmName: 'green-alg',
                requestType: 'batch',
            });
            expect(res).to.deep.include({
                algorithmName: 'yellow-alg',
                requestType: 'batch',
            });
        });

        it('should filter requests not in algorithmTemplateStore', () => {
            const stub = [
                {
                    data: [
                        {
                            name: 'black-alg',
                        },
                        {
                            name: 'black-alg',
                        },
                        {
                            name: 'yellow-alg',
                        },
                        {
                            name: 'green-alg',
                        }

                    ]
                }
            ];
            const algorithmTemplateStore = {
                'yellow-alg':{},
                'green-alg':{},
            }
            const res = normalizeRequests(stub, algorithmTemplateStore);
            expect(res).to.have.length(2);
            expect(res).to.not.deep.include({
                algorithmName: 'black-alg',
                requestType: 'batch',
            });
            expect(res).to.deep.include({
                algorithmName: 'green-alg',
                requestType: 'batch',
            });
            expect(res).to.deep.include({
                algorithmName: 'yellow-alg',
                requestType: 'batch',
            });
        });

        it('should apply correct requestType', () => {
            const stub = [
                {
                    data: [
                        {
                            name: 'stateless',
                        },
                        {
                            name: 'stateful',
                        },
                        {
                            name: 'batch',
                        },
                    ]
                }
            ];
            const algorithmTemplateStore = {
                'stateless': { stateType: stateType.Stateless },
                'stateful': { stateType: stateType.Stateful },
                'batch': { stateType: undefined },
            }

            const res = normalizeRequests(stub, algorithmTemplateStore);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                algorithmName: 'stateless',
                requestType: stateType.Stateless
            });
            expect(res).to.deep.include({
                algorithmName: 'stateful',
                requestType: stateType.Stateful
            });
            expect(res).to.deep.include({
                algorithmName: 'batch',
                requestType: 'batch'
            });
        });
    });

    describe('normalize resources', () => {
        beforeEach(() => {
            globalSettings.useResourceLimits = false
        });

        it('should work with empty resources array', () => {
            const res = normalizeResources({});
            expect(res.allNodes.ratio.cpu).to.eq(0);
            expect(res.allNodes.ratio.memory).to.eq(0);
        });

        it('should work with undefined resources array', () => {
            const res = normalizeResources();
            expect(res.allNodes.ratio.cpu).to.eq(0);
            expect(res.allNodes.ratio.memory).to.eq(0);
        });

        it('should return resources by node and totals', () => {
            const res = normalizeResources({ pods, nodes });
            expect(res.allNodes.total.cpu).to.eq(23.4);
            expect(res.allNodes.total.memory).to.eq(98304);
            expect(res.nodeList[0].requests.cpu).to.eq(0.2);
            expect(res.nodeList[1].requests.cpu).to.eq(0.25);
            expect(res.nodeList[2].requests.cpu).to.eq(0);
        });

        it('should return resources by node and totals with useLimits', () => {
            globalSettings.useResourceLimits = true
            const res = normalizeResources({ pods, nodes });
            expect(res.allNodes.total.cpu).to.eq(23.4);
            expect(res.allNodes.total.memory).to.eq(98304);
            expect(res.nodeList[0].requests.cpu).to.eq(0.2);
            expect(res.nodeList[1].requests.cpu).to.eq(0.7);
            expect(res.nodeList[2].requests.cpu).to.eq(0);
        });

        it('should return resources free resources by node', () => {
            const res = normalizeResources({ pods, nodes });
            expect(res.allNodes.free.cpu).to.eq(22.95);
            expect(res.allNodes.free.memory).to.eq(97664);
            expect(res.nodeList[0].free.cpu).to.eq(7.6);
            expect(res.nodeList[1].free.cpu).to.eq(7.55);
            expect(res.nodeList[2].free.cpu).to.eq(7.8);
        });

        it('should filter out nodes with NoSchedule taint', () => {
            const nodesWithTaint = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, spec: { taints: [{ effect: 'NoSchedule' }] }, status: { allocatable: { cpu: '4', memory: '8Gi' } } },
                        { metadata: { name: 'node2', labels: {} }, status: { allocatable: { cpu: '2', memory: '4Gi' } } }
                    ]
                }
            };
            const podsEmpty = { body: { items: [] } };

            const res = normalizeResources({ pods: podsEmpty, nodes: nodesWithTaint });
            expect(res.nodeList.length).to.eq(1);
            expect(res.nodeList[0].name).to.eq('node2');
        });

        it('should ignore pods not in Running or Pending state', () => {
            const nodes = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }
                    ]
                }
            };
            const pods = {
                body: {
                    items: [
                        { status: { phase: 'Succeeded' }, spec: { nodeName: 'node1', containers: [] } },
                        { status: { phase: 'Failed' }, spec: { nodeName: 'node1', containers: [] } }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            expect(res.nodeList[0].requests.cpu).to.eq(0);
            expect(res.nodeList[0].requests.memory).to.eq(0);
        });

        it('should account worker pods separately from other pods', () => {
            const nodes = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }
                    ]
                }
            };
            const pods = {
                body: {
                    items: [
                        {
                            status: { phase: 'Running' },
                            spec: { nodeName: 'node1', containers: [{ resources: { requests: { cpu: '100m', memory: '128Mi' } } }] },
                            metadata: { labels: { type: 'worker', 'algorithm-name': 'algo1' }, name: 'workerPod1' }
                        },
                        {
                            status: { phase: 'Running' },
                            spec: { nodeName: 'node1', containers: [{ resources: { requests: { cpu: '200m', memory: '256Mi' } } }] },
                            metadata: { labels: { type: 'other' }, name: 'otherPod1' }
                        }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            const node = res.nodeList[0];
            expect(node.workersTotal.cpu).to.eq(0.1);
            expect(node.other.cpu).to.eq(0.2);
            expect(node.workers.length).to.eq(1);
            expect(node.workers[0].algorithmName).to.eq('algo1');
        });

        it('should calculate GPU resources correctly', () => {
            const nodes = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi', 'nvidia.com/gpu': '2' } } }
                    ]
                }
            };
            const pods = {
                body: {
                    items: [
                        {
                            status: { phase: 'Running' },
                            spec: { nodeName: 'node1', containers: [{ resources: { limits: { 'nvidia.com/gpu': '1' } } }] },
                            metadata: { labels: {}, name: 'gpuPod1' }
                        }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            const node = res.nodeList[0];
            expect(node.total.gpu).to.eq(2);
            expect(node.requests.gpu).to.eq(1);
            expect(node.free.gpu).to.eq(1);
            expect(node.ratio.gpu).to.eq(0.5);
        });

        it('should accumulate limits separately from requests', () => {
            const nodes = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }
                    ]
                }
            };
            const pods = {
                body: {
                    items: [
                        {
                            status: { phase: 'Running' },
                            spec: {
                                nodeName: 'node1',
                                containers: [{
                                    resources: {
                                        requests: { cpu: '100m', memory: '128Mi' },
                                        limits: { cpu: '200m', memory: '256Mi' }
                                    }
                                }]
                            },
                            metadata: { labels: {}, name: 'pod1' }
                        }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            const node = res.nodeList[0];
            expect(node.requests.cpu).to.eq(0.1);
            expect(node.limits.cpu).to.eq(0.2);
            expect(node.requests.memory).to.eq(128);
            expect(node.limits.memory).to.eq(256);
        });

        it('should include nodes with no pods in nodeList with zero requests', () => {
            const nodes = {
                body: {
                    items: [
                        { metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }
                    ]
                }
            };
            const pods = { body: { items: [] } };

            const res = normalizeResources({ pods, nodes });
            expect(res.nodeList[0].requests.cpu).to.eq(0);
            expect(res.nodeList[0].free.cpu).to.eq(4);
        });

        it('should still use actual requests for worker pods when useResourceLimits=true', () => {
            globalSettings.useResourceLimits = true;
            const nodes = {
                body: { items: [{ metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }] }
            };
            const pods = {
                body: {
                    items: [
                        {
                            status: { phase: 'Running' },
                            spec: {
                                nodeName: 'node1',
                                containers: [{
                                    resources: {
                                        requests: { cpu: '100m', memory: '128Mi' },
                                        limits: { cpu: '1000m', memory: '512Mi' }
                                    }
                                }]
                            },
                            metadata: { labels: { type: 'worker', 'algorithm-name': 'algoX' }, name: 'workerPod1' }
                        }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            const node = res.nodeList[0];

            // requests bucket uses limit (1 core), not request
            expect(node.requests.cpu).to.eq(1);
            // workersTotal should use actual request (0.1 cores)
            expect(node.workersTotal.cpu).to.eq(0.1);
        });

        it('should still use actual requests for "other" pods when useResourceLimits=true', () => {
            globalSettings.useResourceLimits = true;
            const nodes = {
                body: { items: [{ metadata: { name: 'node1', labels: {} }, status: { allocatable: { cpu: '4', memory: '8Gi' } } }] }
            };
            const pods = {
                body: {
                    items: [
                        {
                            status: { phase: 'Running' },
                            spec: {
                                nodeName: 'node1',
                                containers: [{
                                    resources: {
                                        requests: { cpu: '200m', memory: '256Mi' },
                                        limits: { cpu: '2000m', memory: '1Gi' }
                                    }
                                }]
                            },
                            metadata: { labels: { type: 'other' }, name: 'otherPod1' }
                        }
                    ]
                }
            };

            const res = normalizeResources({ pods, nodes });
            const node = res.nodeList[0];

            // requests bucket uses limit (2 cores)
            expect(node.requests.cpu).to.eq(2);
            // "other" bucket should still use actual request (0.2 cores)
            expect(node.other.cpu).to.eq(0.2);
        });
    });

    describe('merge workers', () => {
        it('should work with empty items', () => {
            const merged = attacheJobToWorker([], []);
            expect(merged.jobAttachedWorkers).to.be.an('array');
            expect(merged.jobAttachedWorkers).to.be.empty;
            expect(merged.extraJobs).to.be.an('array');
            expect(merged.extraJobs).to.be.empty;
        });

        it('should keep all workers, and not change with no jobs', () => {
            const merged = attacheJobToWorker(workersStub, []);
            expect(merged.jobAttachedWorkers).to.be.an('array')
            expect(merged.jobAttachedWorkers).to.have.length(workersStub.length);
            expect(merged.jobAttachedWorkers[0].job).to.not.exist;
            expect(merged.jobAttachedWorkers[1].job).to.not.exist;
            expect(merged.extraJobs).to.be.empty;
        });

        it('should keep all workers, and enrich with one jobs', () => {
            const merged = attacheJobToWorker(workersStub, jobsStub.slice(0, 1));
            expect(merged.jobAttachedWorkers).to.be.an('array')
            expect(merged.jobAttachedWorkers).to.have.length(workersStub.length);
            expect(merged.jobAttachedWorkers[0].job).to.eql(jobsStub[0]);
            expect(merged.jobAttachedWorkers[1].job).to.not.exist;
            expect(merged.extraJobs).to.be.empty;
        });

        it('should keep all workers, and enrich with all jobs', () => {
            const merged = attacheJobToWorker(workersStub, jobsStub);
            expect(merged.jobAttachedWorkers).to.be.an('array')
            expect(merged.jobAttachedWorkers).to.have.length(workersStub.length);
            expect(merged.jobAttachedWorkers[0].job).to.eql(jobsStub[0]);
            expect(merged.jobAttachedWorkers[1].job).to.eql(jobsStub[1]);
            expect(merged.jobAttachedWorkers[2].job).to.eql(jobsStub[2]);
            expect(merged.jobAttachedWorkers[3].job).to.eql(jobsStub[3]);
            expect(merged.extraJobs).to.be.empty;
        });

        it('should report all jobs as extra jobs', () => {
            const merged = attacheJobToWorker([], jobsStub);
            expect(merged.jobAttachedWorkers).to.be.an('array')
            expect(merged.jobAttachedWorkers).to.be.empty;
            expect(merged.extraJobs).to.have.length(jobsStub.length);
            expect(merged.extraJobs[0]).to.eql(jobsStub[0]);
            expect(merged.extraJobs[1]).to.eql(jobsStub[1]);
            expect(merged.extraJobs[2]).to.eql(jobsStub[2]);
            expect(merged.extraJobs[3]).to.eql(jobsStub[3]);
        });
        it('should report extra jobs', () => {
            const merged = attacheJobToWorker(workersStub.slice(0, 1), jobsStub);
            expect(merged.jobAttachedWorkers).to.be.an('array')
            expect(merged.jobAttachedWorkers).to.have.length(1);
            expect(merged.extraJobs).to.have.length(3);
            expect(merged.extraJobs[0]).to.eql(jobsStub[1]);
            expect(merged.extraJobs[1]).to.eql(jobsStub[2]);
            expect(merged.extraJobs[2]).to.eql(jobsStub[3]);
        });
    });
});
