/* eslint-disable global-require */
const { expect } = require('chai');
const etcd = require('../lib/helpers/etcd');
const decache = require('decache');
const { discoveryStub } = require('./stub/discoveryStub');
describe('bootstrap', () => {
    before(async () => {
        await require('../bootstrap').init();
    });
    after(() => {
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
});
