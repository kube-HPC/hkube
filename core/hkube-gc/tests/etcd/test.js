const { expect } = require('chai');
const sinon = require('sinon');
const etcdMock = require('./mocks/etcd-store');
const cleanerManager = require('../../lib/cleaner-manager');
let cleaner;

describe('Etcd', () => {
    before(async () => {
        cleaner = cleanerManager.getCleaner('etcd');
    });
    it('clean objects', async () => {
        const etcdSpy = sinon.spy(etcdMock, "deleteKey");
        await cleaner.clean();
        expect(etcdSpy.callCount).to.equal(3);
    });
});