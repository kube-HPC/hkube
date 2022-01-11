const { expect } = require('chai');
const sinon = require('sinon');
const etcdMock = require('./mocks/etcd-store');
let cleaner, cleanerManager;

describe('Etcd', () => {
    before(async () => {
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('etcd');
    });
    it('clean objects', async () => {
        etcdMock.reset()
        const etcdSpy = sinon.spy(etcdMock, "deleteKey");
        await cleaner.clean();
        expect(etcdSpy.callCount).to.equal(3);
    });
});