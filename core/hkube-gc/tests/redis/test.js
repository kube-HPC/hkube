const { expect } = require('chai');
const sinon = require('sinon');
const redisMock = require('./mocks/redis-store');
const cleanerManager = require('../../lib/cleaner-manager');
let cleaner;

describe('Redis', () => {
    before(async () => {
        cleaner = cleanerManager.getCleaner('redis');
    });
    it('clean objects', async () => {
        const redisSpy = sinon.spy(redisMock, "deleteKey");
        await cleaner.clean();
        expect(redisSpy.callCount).to.equal(2);
    });
});