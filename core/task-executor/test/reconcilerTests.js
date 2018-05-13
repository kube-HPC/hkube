const { expect } = require('chai');
const mockery = require('mockery');
const decache = require('decache');
let reconciler;
// const { mock, callCount } = (require('./mocks/kubernetes.mock')).kubernetes();
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes()
const { log } = require('./mocks/log.mock')
const etcd = require('../lib/helpers/etcd');
const { templateStore } = require('./stub/templateStore');

const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers} = require('../lib/reconcile/normalize');

const { workersStub, jobsStub } = require('./stub/normalizedStub');

describe('reconciler', () => {
    before(async () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            // useCleanCache: true
        });

        // mockery.registerMock('@hkube/logger', log);
        mockery.registerMock('../helpers/kubernetes', mock);
        const bootstrap = require('../bootstrap');

        await bootstrap.init();

        reconciler = require('../lib/reconcile/reconciler')
        // push to etcd
        await Promise.all(Object.entries(templateStore).map(([name, data]) => {
            return etcd._etcd.algorithms.templatesStore.setAlgorithm({ name, data });
        }));

    });
    after(() => {
        mockery.disable();
        decache('../bootstrap');

    });

    beforeEach(() => {
        clearCount();
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
                    alg: 'black-alg',
                    data: {
                        pods: 7
                    }
                },
                {
                    alg: 'green-alg',
                    data: {
                        pods: 1
                    }
                },
                {
                    alg: 'yellow-alg',
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
            const merged = mergeWorkers(workersStub, jobsStub.slice(0,1));
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
            const merged = mergeWorkers(workersStub.slice(0,1), jobsStub);
            expect(merged.mergedWorkers).to.be.an('array')
            expect(merged.mergedWorkers).to.have.length(1);
            expect(merged.extraJobs).to.have.length(3);
            expect(merged.extraJobs[0]).to.eql(jobsStub[1]);
            expect(merged.extraJobs[1]).to.eql(jobsStub[2]);
            expect(merged.extraJobs[2]).to.eql(jobsStub[3]);
            
        });
    });

    describe('reconcile tests', () => {

        it('should work with no params', async () => {
            const res = await reconciler.reconcile();
            expect(res).to.exist
            expect(res).to.be.empty
            expect(callCount('createJob')).to.be.undefined

        })

        it('should work with one algo', async () => {
            const res = await reconciler.reconcile({
                algorithmRequests: [{
                    alg: 'green-alg',
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        it('should work with custom worker', async () => {
            await etcd._etcd.algorithms.templatesStore.setAlgorithm({
                name: 'green-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    workerImage: 'myregistry:5000/stam/myworker:v2'
                }
            });
            const res = await reconciler.reconcile({
                algorithmRequests: [{
                    alg: 'green-alg',
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
    });
});
