const { expect } = require('chai');
const mockery = require('mockery');
const etcd = require('../lib/helpers/etcd');
const { discoveryStub, templateStoreStub } = require('./stub/discoveryStub');
const { mock } = (require('./mocks/kubernetes.mock')).kubernetes()

describe('bootstrap', () => {
    before(async () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            // useCleanCache: true
        });
        mockery.registerMock('./lib/helpers/kubernetes', mock);
        const bootstrap = require('../bootstrap');
        await bootstrap.init();
    });
    after(() => {
        mockery.disable();
    });
    it('should init without error', async () => {

    });
    it('should get', async () => {
        await Promise.all(Object.keys(discoveryStub).map(path => etcd._etcd._client.put(path, discoveryStub[path])));
        const workers = await etcd.getWorkers({ workerServiceName: 'stub' });
        expect(workers).to.eql(discoveryStub);
    });
    it('should get no workers', async () => {
        await Promise.all(Object.keys(discoveryStub).map(path => etcd._etcd._client.put(path, discoveryStub[path])));
        const workers = await etcd.getWorkers({ workerServiceName: 'stub2' });
        expect(workers).to.be.empty;
    });
    it('should get template store', async () => {
        const algo = 'algo2';
        await Promise.all(templateStoreStub.map(t => etcd._etcd._client.put(`/algorithmTemplates/${t.name}`, t)));
        const templates = await etcd.getAlgorithmTemplate();
        const alg1 = templates[algo];
        const alg2 = templateStoreStub.find(t => t.name === algo);
        expect(alg1).to.deep.eql(alg2);
    });
});
