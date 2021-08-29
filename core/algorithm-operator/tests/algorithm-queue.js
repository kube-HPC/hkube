const { expect } = require('chai');
const sinon = require('sinon');
const algorithms = require('./stub/algorithms');
const discovery = require('./stub/algorithm-queue-discovery.json');
const deployments = require('./stub/algorithm-queue-deployments.json');
const algorithmQueueMap = require('./stub/algorithm-queue-map.json');
const jobsMessageQueue = require('../lib/helpers/jobs-message-queue');
const etcd = require('../lib/helpers/etcd');
let config;
let algorithmQueueReconciler;
let kubernetesMock;
const sandbox = sinon.createSandbox();
let spy;

describe('algorithm-queue', () => {
    before(() => {
        config = global.testParams.config;
        kubernetesMock = global.testParams.kubernetesMock;
        const map = {};
        algorithms.map((a) => {
            map[a.name] = 1;
        });
        sinon.stub(jobsMessageQueue, 'getWaitingCount').resolves(map);
        sinon.stub(etcd, 'getAlgorithmQueuesMap').resolves(algorithmQueueMap);
        algorithmQueueReconciler = require('../lib/reconcile/algorithm-queue');
    });
    beforeEach(() => {
        spy = sandbox.spy(kubernetesMock, 'createDeployment');
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe('reconcile', () => {
        it('should not add new deployments', async () => {
            await algorithmQueueReconciler.reconcile({
                deployments,
                algorithms,
                discovery,
                options: config
            });
            expect(spy.callCount).to.eql(0);
        });
        it('should add new deployments', async () => {
            await algorithmQueueReconciler.reconcile({
                deployments: null,
                algorithms,
                discovery,
                options: config
            });
            expect(spy.callCount).to.eql(2);
        });
    });
});
