const os = require('os');
const crypto = require('crypto');
const { Factory } = require('@hkube/redis-utils');

const LOCK_PREFIX = 'hkube:api-server:lock';

// Shared key for electing a single api-server leader across all instances.
// The leader is the sole instance that performs singleton work (dispatching
// job-result-change events and running the bootstrap migration).
const LEADER_KEY = 'leader';

// Atomically acquire the lock if it is free, or renew it if it is already held by
// THIS instance. Returns 1 when this instance owns the lock, 0 otherwise.
// This way the first instance to acquire the key keeps ownership as long as it
// keeps renewing (touching) before the ttl expires.
const ACQUIRE_OR_RENEW_SCRIPT = `
local current = redis.call('get', KEYS[1])
if current == false then
    redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
    return 1
elseif current == ARGV[1] then
    redis.call('pexpire', KEYS[1], ARGV[2])
    return 1
end
return 0
`;

class RedisLock {
    init(options) {
        if (this._client) {
            return;
        }
        this._client = Factory.getClient(options.redis);
        // unique per-process owner id, so only the owning instance can renew the lease
        this._instanceId = `${os.hostname()}:${crypto.randomUUID()}`;
    }

    // Acquire the lock for the given key, or renew its ttl if this instance already
    // owns it. Returns true when this instance is the owner and should handle the event.
    async acquireOrRenew(key, ttlMs) {
        const result = await this._client.eval(ACQUIRE_OR_RENEW_SCRIPT, 1, `${LOCK_PREFIX}:${key}`, this._instanceId, ttlMs);
        return result === 1;
    }
}

const redisLock = new RedisLock();
redisLock.LEADER_KEY = LEADER_KEY;
module.exports = redisLock;
