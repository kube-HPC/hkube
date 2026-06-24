const { expect } = require('chai');
const { Factory } = require('@hkube/redis-utils');
const redisLockSingleton = require('../lib/utils/redis-lock');

// Must match LOCK_PREFIX in lib/utils/redis-lock.js
const LOCK_PREFIX = 'hkube:api-server:lock';
const fullKey = (key) => `${LOCK_PREFIX}:${key}`;
const delay = (d) => new Promise((r) => setTimeout(r, d));

// RedisLock is exported as a singleton; the live api-server instance uses it for its
// leader heartbeat. To avoid disturbing that, every test builds its own fresh instance
// (Factory.getClient returns a new connection each call) and only touches `test-*` keys,
// never the live `leader` key.
const RedisLock = redisLockSingleton.constructor;

describe('RedisLock', () => {
    let config;
    let rawClient;
    let locks;

    const newLock = (instanceId = 'test-instance-1') => {
        const lock = new RedisLock();
        lock.init(config, instanceId);
        locks.push(lock);
        return lock;
    };

    before(() => {
        config = global.testParams.config;
        rawClient = Factory.getClient(config.redis);
    });

    beforeEach(() => {
        locks = [];
    });

    afterEach(async () => {
        const keys = await rawClient.keys(`${LOCK_PREFIX}:test-*`);
        if (keys.length) {
            await rawClient.del(...keys);
        }
        await Promise.all(locks.flatMap((lock) => [
            lock._client && lock._client.quit().catch(() => { }),
            lock._subscriber && lock._subscriber.quit().catch(() => { }),
        ].filter(Boolean)));
    });

    after(async () => {
        await rawClient.quit().catch(() => { });
    });

    describe('init', () => {
        it('should expose the provided instanceId', () => {
            const lock = newLock('my-instance');
            expect(lock.instanceId).to.equal('my-instance');
        });
        it('should generate an instanceId when none is provided', () => {
            const lock = new RedisLock();
            lock.init(config);
            locks.push(lock);
            expect(lock.instanceId).to.be.a('string');
            expect(lock.instanceId).to.include(':');
        });
        it('should be idempotent and keep the first client and id', () => {
            const lock = newLock('first-id');
            const client = lock._client;
            lock.init(config, 'second-id');
            expect(lock._client).to.equal(client);
            expect(lock.instanceId).to.equal('first-id');
        });
    });

    describe('acquireOrRenew', () => {
        it('should acquire a free lock and store the instanceId as the value', async () => {
            const lock = newLock();
            const acquired = await lock.acquireOrRenew('test-acquire', 2000);
            expect(acquired).to.be.true;
            const owner = await rawClient.get(fullKey('test-acquire'));
            expect(owner).to.equal('test-instance-1');
        });
        it('should set a bounded ttl on the acquired lock', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-ttl', 2000);
            const pttl = await rawClient.pttl(fullKey('test-ttl'));
            expect(pttl).to.be.greaterThan(0);
            expect(pttl).to.be.at.most(2000);
        });
        it('should renew a lock it already owns and extend the ttl', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-renew', 500);
            await delay(150);
            const renewed = await lock.acquireOrRenew('test-renew', 2000);
            expect(renewed).to.be.true;
            const pttl = await rawClient.pttl(fullKey('test-renew'));
            expect(pttl).to.be.greaterThan(500);
        });
        it('should not acquire a lock held by another instance', async () => {
            const lock = newLock();
            await rawClient.set(fullKey('test-foreign'), 'other-instance', 'PX', 5000);
            const acquired = await lock.acquireOrRenew('test-foreign', 2000);
            expect(acquired).to.be.false;
            const owner = await rawClient.get(fullKey('test-foreign'));
            expect(owner).to.equal('other-instance');
        });
        it('should acquire once a foreign lock has expired', async () => {
            const lock = newLock();
            await rawClient.set(fullKey('test-takeover'), 'other-instance', 'PX', 100);
            await delay(150);
            const acquired = await lock.acquireOrRenew('test-takeover', 2000);
            expect(acquired).to.be.true;
            const owner = await rawClient.get(fullKey('test-takeover'));
            expect(owner).to.equal('test-instance-1');
        });
        it('should keep a single owner under concurrent acquisition by two instances', async () => {
            const lockA = newLock('instance-a');
            const lockB = newLock('instance-b');
            const [a, b] = await Promise.all([
                lockA.acquireOrRenew('test-race', 2000),
                lockB.acquireOrRenew('test-race', 2000),
            ]);
            expect([a, b]).to.include(true);
            expect(a && b).to.be.false;
            const owner = await rawClient.get(fullKey('test-race'));
            expect(owner).to.be.oneOf(['instance-a', 'instance-b']);
        });
    });

    describe('exists', () => {
        it('should return false when the key is absent', async () => {
            const lock = newLock();
            expect(await lock.exists('test-missing')).to.be.false;
        });
        it('should return true when the key is present', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-present', 2000);
            expect(await lock.exists('test-present')).to.be.true;
        });
    });

    describe('getOwner', () => {
        it('should return null when the key is absent', async () => {
            const lock = newLock();
            expect(await lock.getOwner('test-no-owner')).to.be.null;
        });
        it('should return this instance id when it owns the lock', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-self-owner', 2000);
            expect(await lock.getOwner('test-self-owner')).to.equal('test-instance-1');
        });
        it('should return the foreign id when another instance owns the lock', async () => {
            const lock = newLock();
            await rawClient.set(fullKey('test-other-owner'), 'foreign-id', 'PX', 5000);
            expect(await lock.getOwner('test-other-owner')).to.equal('foreign-id');
        });
    });

    describe('watchKeyRemoval', () => {
        it('should invoke onGone with "del" when the watched key is deleted', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-watch-del', 60000);
            let resolveGone;
            const gone = new Promise((resolve) => { resolveGone = resolve; });
            await lock.watchKeyRemoval('test-watch-del', (event) => resolveGone(event));
            await rawClient.del(fullKey('test-watch-del'));
            const event = await gone;
            expect(event).to.equal('del');
        });
        it('should invoke onGone with "expired" when the watched key expires', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-watch-expire', 60000);
            let resolveGone;
            const gone = new Promise((resolve) => { resolveGone = resolve; });
            await lock.watchKeyRemoval('test-watch-expire', (event) => resolveGone(event));
            await rawClient.pexpire(fullKey('test-watch-expire'), 100);
            // Force-read after expiry so redis emits the expired event promptly.
            await delay(150);
            await rawClient.get(fullKey('test-watch-expire'));
            const event = await gone;
            expect(event).to.equal('expired');
        });
        it('should not invoke onGone for unrelated key changes', async () => {
            const lock = newLock();
            await lock.acquireOrRenew('test-watch-quiet', 60000);
            let called = false;
            await lock.watchKeyRemoval('test-watch-quiet', () => { called = true; });
            await rawClient.set(fullKey('test-watch-other'), 'x', 'PX', 2000);
            await rawClient.del(fullKey('test-watch-other'));
            await delay(200);
            expect(called).to.be.false;
        });
    });
});
