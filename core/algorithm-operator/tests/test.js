const { expect } = require('chai');
const mockery = require('mockery');
const etcd = require('../lib/helpers/etcd');
const decache = require('decache');
const { templateStoreStub } = require('./stub/discoveryStub');
const { callCount, mock } = (require('./mocks/kubernetes.mock')).kubernetes()

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
        decache('../bootstrap');
    });
    beforeEach(async () => {
        await etcd._etcd._client.delete('/algorithms/store', { isPrefix: true })
    });
    it('should init without error', async () => {

    });
    it('should get template store', async () => {
        await Promise.all(templateStoreStub.map(a => etcd._etcd.algorithms.store.set(a)));
        const template = await etcd.getAlgorithmTemplate({ name: 'algo2' });
        expect(template).to.eql(templateStoreStub[1]);
    });

    it('should list template store', async () => {
        await Promise.all(templateStoreStub.map(a => etcd._etcd.algorithms.store.set(a)));
        const { algorithms, count } = await etcd.getAlgorithmTemplates();
        expect(algorithms).to.deep.include(templateStoreStub[1]);
        expect(algorithms.length).to.eql(count);
    });
    it('should list template store above limit', async () => {

        await Promise.all([...Array(110).keys()].map(i => etcd._etcd.algorithms.store.set({
            name: `key-${i}`,
        })));
        const { algorithms, count } = await etcd.getAlgorithmTemplates();
        expect(algorithms).to.deep.include({ name: 'key-99' });
        expect(algorithms.length).to.not.eql(count);
    });
});
