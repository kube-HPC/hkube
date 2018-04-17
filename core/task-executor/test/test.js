/* eslint-disable global-require */
const { expect } = require('chai');
const mockery = require('mockery');
const etcd = require('../lib/helpers/etcd');
const decache = require('decache');
const { discoveryStub, templateStoreStub } = require('./stub/discoveryStub');
const { kubernetes } = require('./mocks/kubernetes.mock');
describe('bootstrap', () => {
    before(async () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            // useCleanCache: true
        });
        mockery.registerMock('./lib/helpers/kubernetes', kubernetes);
        const bootstrap = require('../bootstrap');

        await bootstrap.init();
    });
    after(() => {
        mockery.disable();
        decache('../bootstrap');
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
        await Promise.all(Object.keys(templateStoreStub).map(path => etcd._etcd._client.put(path, templateStoreStub[path])));
        const template = await etcd.getAlgorithmTemplate({ algorithmName: 'algo2' });
        expect(template).to.eql(templateStoreStub['/templatesStore/algo2']);
    });
});
