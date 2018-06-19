const { expect } = require('chai');
const mockery = require('mockery');
const decache = require('decache');
let reconciler;
// const { mock, callCount } = (require('./mocks/kubernetes.mock')).kubernetes();
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes()
const { log } = require('./mocks/log.mock');
const etcd = require('../lib/helpers/etcd');
const { templateStore } = require('./stub/templateStore');

const { normalizeWorkers, normalizeRequests, mergeWorkers } = require('../lib/reconcile/normalize');

const { workersStub, jobsStub } = require('./stub/normalizedStub');

const { pods, nodes } = require('./stub/resources');

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
            return etcd._etcd.algorithms.templatesStore.set({ name, data });
        }));

    });
    after(() => {
        mockery.disable();
        decache('../bootstrap');

    });

    beforeEach(() => {
        clearCount();
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
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'green-alg',
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
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
        it('should work with algorithm with not enough cpu', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'hungry-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    cpu: 8,
                    mem: '100'
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
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
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 2, skipped: 2 } });
            expect(callCount('createJob').length).to.eql(2);
        });
        it('should only create 30 in one iteration', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'hungry-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    cpu: 0.1,
                    mem: '100'
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 40
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
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 40, paused: 0, pending: 0, created: 30, skipped: 10 } });
            expect(callCount('createJob').length).to.eql(30);
        });
        it('should work with algorithm with enough resources', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'hungry-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    cpu: 4,
                    mem: '100'
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
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
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 4, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(4);
        });
        it('should work with algorithm with not enough memory', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'hungry-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    cpu: 4,
                    mem: '40000'
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
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
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 2, skipped: 2 } });
            expect(callCount('createJob').length).to.eql(2);
        });
        it('should work with custom worker', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'green-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    workerImage: 'myregistry:5000/stam/myworker:v2'
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'green-alg',
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
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
        it('should work with env', async () => {
            await etcd._etcd.algorithms.templatesStore.set({
                name: 'green-alg',
                data: {
                    algorithmImage: 'hkube/algorithm-example',
                    workerEnv: {
                        myEnv: 'myValue'
                    },
                    algorithmEnv: {
                        myAlgoEnv: 'myAlgoValue'
                    }
                }
            });
            const res = await reconciler.reconcile({
                resources: { pods, nodes },
                algorithmRequests: [{
                    name: 'green-alg',
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
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include({ name: 'myEnv', value: 'myValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].env).to.deep.include({ name: 'myAlgoEnv', value: 'myAlgoValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
    });
});
