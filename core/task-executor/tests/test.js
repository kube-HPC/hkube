const { expect } = require('chai');
const etcd = require('../lib/helpers/etcd');
const { discoveryStub, templateStoreStub } = require('./stub/discoveryStub');

describe('bootstrap', () => {
    it('should get', async () => {
        await Promise.all(discoveryStub.map(d => etcd._etcd._client.put(`/discovery/stub/${d.workerId}`, d)));
        let workers = await etcd.getWorkers({ workerServiceName: 'stub' });
        workers = workers.sort((a, b) => a.workerId - b.workerId)
        expect(workers).to.eql(discoveryStub);
    });
    it('should get more than 100', async () => {
        await etcd._etcd._client.delete('/discovery/stub', { isPrefix: true })
        await Promise.all([...Array(500).keys()].map(d => etcd._etcd._client.put(`/discovery/stub/${d}`, d)));
        let workers = await etcd.getWorkers({ workerServiceName: 'stub' });
        expect(workers).to.have.lengthOf(500)
    });
    it('should get no workers', async () => {
        await Promise.all(discoveryStub.map(d => etcd._etcd._client.put(`/discovery/stub/${d.workerId}`, d)));
        const workers = await etcd.getWorkers({ workerServiceName: 'stub2' });
        expect(workers).to.be.empty;
    });
    it('should get template store', async () => {
        const algo = 'algo2';
        await etcd._db.algorithms.createMany(templateStoreStub);
        const templates = await etcd.getAlgorithmTemplate();
        const alg1 = templates[algo];
        const alg2 = templateStoreStub.find(t => t.name === algo);
        expect(alg1).to.deep.eql(alg2);
    });
});
