const { expect } = require('chai');
const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers, normalizeResources, normalizeHotRequests, normalizeColdWorkers } = require('../lib/reconcile/normalize');
const { twoCompleted } = require('./stub/jobsRaw');
const utils = require('../lib/utils/utils');
const { workersStub, jobsStub } = require('./stub/normalizedStub');
const { nodes, pods } = require('./stub/resources');
let templateStore = require('./stub/templateStore');
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
        it('should return hot workers', () => {
            const normRequests = [
                {
                    "algorithmName": "green-alg"
                },
                {
                    "algorithmName": "black-alg"
                },
                {
                    "algorithmName": "eval-alg"
                },
                {
                    "algorithmName": "yellow-alg"
                }
            ]
            const minHotWorkers = Object.values(algorithmTemplates).map(a => a.minHotWorkers).reduce((a, b) => a + b, 0);
            const res = normalizeHotRequests(normRequests, algorithmTemplates);
            expect(res).to.have.lengthOf(minHotWorkers);
            expect(res[0]).to.have.property('algorithmName');
            expect(res[0]).to.have.property('hotWorker');
        });
        it('should return hot workers and not hot workers', () => {
            const normRequests = [
                {
                    "algorithmName": "green-alg"
                },
                {
                    "algorithmName": "black-alg"
                },
                {
                    "algorithmName": "eval-alg"
                },
                {
                    "algorithmName": "yellow-alg"
                },
                {
                    "algorithmName": "nothot-alg"
                },
                {
                    "algorithmName": "nothot-alg"
                },
                {
                    "algorithmName": "nothot-alg"
                }
            ]


            const minHotWorkers = Object.values(algorithmTemplates).map(a => a.minHotWorkers).reduce((a, b) => a + b, 0);
            const res = normalizeHotRequests(normRequests, algorithmTemplates);
            expect(res).to.have.lengthOf(minHotWorkers + 3);
            expect(res[0]).to.have.property('algorithmName');
            expect(res[0]).to.have.property('hotWorker');
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
            const res = normalizeRequests(stub);
            expect(res).to.have.length(4);
            expect(res).to.deep.include({
                algorithmName: 'black-alg',
            });
            expect(res.filter(r => r.algorithmName === 'black-alg')).to.have.lengthOf(2);
            expect(res).to.deep.include({
                algorithmName: 'green-alg',
            });
            expect(res).to.deep.include({
                algorithmName: 'yellow-alg',
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
    });
    describe('merge workers', () => {
        it('should work with empty items', () => {
            const merged = mergeWorkers([], []);
            expect(merged.mergedWorkers).to.be.an('array');
            expect(merged.mergedWorkers).to.be.empty;
            expect(merged.extraJobs).to.be.an('array');
            expect(merged.extraJobs).to.be.empty;
        });
        it('should keep all workers, and not change with no jobs', () => {
            const merged = mergeWorkers(workersStub, []);
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.have.length(workersStub.length);
            expect(merged.mergedWorkers[0].job).to.not.exist;
            expect(merged.mergedWorkers[1].job).to.not.exist;
            expect(merged.extraJobs).to.be.empty;

        });

        it('should keep all workers, and enrich with one jobs', () => {
            const merged = mergeWorkers(workersStub, jobsStub.slice(0, 1));
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.have.length(workersStub.length);
            expect(merged.mergedWorkers[0].job).to.eql(jobsStub[0]);
            expect(merged.mergedWorkers[1].job).to.not.exist;
            expect(merged.extraJobs).to.be.empty;

        });
        it('should keep all workers, and enrich with all jobs', () => {
            const merged = mergeWorkers(workersStub, jobsStub);
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.have.length(workersStub.length);
            expect(merged.mergedWorkers[0].job).to.eql(jobsStub[0]);
            expect(merged.mergedWorkers[1].job).to.eql(jobsStub[1]);
            expect(merged.mergedWorkers[2].job).to.eql(jobsStub[2]);
            expect(merged.mergedWorkers[3].job).to.eql(jobsStub[3]);
            expect(merged.extraJobs).to.be.empty;

        });

        it('should report all jobs as extra jobs', () => {
            const merged = mergeWorkers([], jobsStub);
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.be.empty;
            expect(merged.extraJobs).to.have.length(jobsStub.length);
            expect(merged.extraJobs[0]).to.eql(jobsStub[0]);
            expect(merged.extraJobs[1]).to.eql(jobsStub[1]);
            expect(merged.extraJobs[2]).to.eql(jobsStub[2]);
            expect(merged.extraJobs[3]).to.eql(jobsStub[3]);

        });
        it('should report extra jobs', () => {
            const merged = mergeWorkers(workersStub.slice(0, 1), jobsStub);
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.have.length(1);
            expect(merged.extraJobs).to.have.length(3);
            expect(merged.extraJobs[0]).to.eql(jobsStub[1]);
            expect(merged.extraJobs[1]).to.eql(jobsStub[2]);
            expect(merged.extraJobs[2]).to.eql(jobsStub[3]);

        });
    });
});
