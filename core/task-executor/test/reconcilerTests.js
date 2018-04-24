const { expect } = require('chai');
const mockery = require('mockery');
const decache = require('decache');
let normalizeWorkers, normalizeRequests, reconcile;
// const { mock, callCount } = (require('./mocks/kubernetes.mock')).kubernetes();
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes()
const { log } = require('./mocks/log.mock')
const etcd = require('../lib/helpers/etcd');

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

        const reconciler = require('../lib/reconcile/reconciler')
        normalizeWorkers = reconciler.normalizeWorkers
        normalizeRequests = reconciler.normalizeRequests;
        reconcile = reconciler.reconcile;

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
            });
            expect(res).to.deep.include({
                id: 'id2',
                algorithmName: 'green-alg',
                workerStatus: 'not-ready',
            });
            expect(res).to.deep.include({
                id: 'ae96e6ba-0352-43c4-8862-0e749d2f76c4',
                algorithmName: 'red-alg',
                workerStatus: 'notready',
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

    describe('reconcile tests', () => {

        it('should work with no params', async () => {
            const res = await reconcile();
            expect(res).to.exist
            expect(res).to.be.empty
            expect(callCount('createJob')).to.be.undefined

        })

        it('should work with one algo', async () => {
            const res = await reconcile({
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
            expect(res).to.exist
            expect(res).to.eql({ 'green-alg': { actual: 0, required: 1 } })
            expect(callCount('createJob').length).to.eql(1)
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        })

        it('should work with custom worker', async () => {
            etcd._etcd.algorithms.templatesStore.setState({
                alg: 'green-alg', 
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    workerImage: 'myregistry:5000/stam/myworker:v2'
                }
            });
            const res = await reconcile({
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
            expect(res).to.exist
            expect(res).to.eql({ 'green-alg': { actual: 0, required: 1 } })
            expect(callCount('createJob').length).to.eql(1)
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        })
    })
});
