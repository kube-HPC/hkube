const { expect } = require('chai');

const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers, normalizeResources } = require('../lib/reconcile/normalize');
const { twoCompleted } = require('./stub/jobsRaw');
const { workersStub, jobsStub } = require('./stub/normalizedStub');
const { nodes, pods } = require('./stub/resources');
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
            const res = normalizeJobs(twoCompleted, j => !j.status.succeeded);
            expect(res).to.have.lengthOf(1);
        });
        it('should ignore active jobs', () => {
            const res = normalizeJobs(twoCompleted, j => j.status.succeeded);
            expect(res).to.have.lengthOf(2);
        });
        it('should return all jobs', () => {
            const res = normalizeJobs(twoCompleted);
            expect(res).to.have.lengthOf(3);
        });
    });

    describe('normalize workers', () => {
        it('should work with empty worker array', () => {
            const workers = {};
            const res = normalizeWorkers(workers);
            expect(res).to.be.empty;
        });
        it('should work with undefined worker array', () => {
            const res = normalizeWorkers();
            expect(res).to.be.empty;
        });
        it('should return object with ids', () => {
            const workers = {
                '/discovery/workers/62eee6c4-6f35-4a2d-8660-fad6295ab334': {
                    algorithmName: 'green-alg',
                    workerStatus: 'ready',
                    jobStatus: 'ready',
                    error: null
                },
                '/discovery/workers/id2': {
                    algorithmName: 'green-alg',
                    workerStatus: 'not-ready',
                    jobStatus: 'ready',
                    error: null
                },
                '/discovery/workers/ae96e6ba-0352-43c4-8862-0e749d2f76c4': {
                    algorithmName: 'red-alg',
                    workerStatus: 'notready',
                    jobStatus: 'ready',
                    error: null
                }
            };
            const res = normalizeWorkers(workers);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                id: '62eee6c4-6f35-4a2d-8660-fad6295ab334',
                algorithmName: 'green-alg',
                workerStatus: 'ready',
                workerPaused: false,
                podName: undefined
            });
            expect(res).to.deep.include({
                id: 'id2',
                algorithmName: 'green-alg',
                workerStatus: 'not-ready',
                workerPaused: false,
                podName: undefined
            });
            expect(res).to.deep.include({
                id: 'ae96e6ba-0352-43c4-8862-0e749d2f76c4',
                algorithmName: 'red-alg',
                workerStatus: 'notready',
                workerPaused: false,
                podName: undefined
            });
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
                    name: 'black-alg',
                    data: {
                        pods: 7
                    }
                },
                {
                    name: 'green-alg',
                    data: {
                        pods: 1
                    }
                },
                {
                    name: 'yellow-alg',
                    data: {
                        pods: 1
                    }
                }
            ];
            const res = normalizeRequests(stub);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                algorithmName: 'black-alg',
                pods: 7
            });
            expect(res).to.deep.include({
                algorithmName: 'green-alg',
                pods: 1
            });
            expect(res).to.deep.include({
                algorithmName: 'yellow-alg',
                pods: 1
            });
        });
    });

    describe('normalize resources', () => {
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
            expect(res.allNodes.total.memory).to.eq(94677.796875);
            expect(res).to.have.property('node1');
            expect(res).to.have.property('node2');
            expect(res).to.have.property('node3');
            expect(res.node1.requests.cpu).to.eq(0.2);
            expect(res.node2.requests.cpu).to.eq(0.25);
            expect(res.node3.requests.cpu).to.eq(0);
        });
    });
    describe('merge workers', () => {
        it('should work with empty items', () => {
            const merged = mergeWorkers([], []);
            expect(merged.mergedWorkers).to.be.an('array')
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
