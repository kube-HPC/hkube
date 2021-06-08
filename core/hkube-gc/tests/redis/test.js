const { expect } = require('chai');
const sinon = require('sinon');
const redisMock = require('./mocks/redis-store');
let cleaner, cleanerManager;

describe('Redis', () => {
    before(async () => {
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('redis');
    });
    it('clean objects', async () => {
        const redisSpy = sinon.spy(redisMock, "deleteKey");
        await cleaner.clean();
        expect(redisSpy.callCount).to.equal(2);
    });
});