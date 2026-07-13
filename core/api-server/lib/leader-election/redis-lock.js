const os = require('os');
const crypto = require('crypto');
const Logger = require('@hkube/logger');
const { Factory } = require('@hkube/redis-utils');
const component = require('../consts/componentNames').LEADER_ELECTION;

const LOCK_PREFIX = 'hkube:api-server:lock';

// Shared key for electing a single api-server leader across all instances.
// The leader is the sole instance that performs singleton work (dispatching
// job-result-change events and running the bootstrap migration).
const LEADER_KEY = 'leader';

// Redis keyspace-notification flags required to learn when the leader key disappears:
//   K = keyspace events (per-key channel __keyspace@<db>__:<key>)
//   g = generic commands (covers DEL)
//   x = expired events (covers TTL expiry)
const KEYSPACE_EVENT_FLAGS = ['K', 'g', 'x'];

// Keyspace events that mean the leader key is gone and an election should run.
const KEY_GONE_EVENTS = ['del', 'expired'];

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
    init(options, instanceId) {
        if (this._client) {
            return;
        }
        this._log = Logger.GetLogFromContainer();
        this._redisOptions = options.redis;
        this._client = Factory.getClient(options.redis);
        // unique per-process owner id, so only the owning instance can renew the lease.
        // Shared with the etcd discovery registration (passed in by the leader-election service)
        // so the lock value matches this api-server's etcd register name; falls back to a generated id.
        this._instanceId = instanceId || `${os.hostname()}:${crypto.randomUUID()}`;
        this._log.info(`leader-election redis lock initialized (instanceId: ${this._instanceId})`, { component });
    }

    // Stable per-process owner id used as the lock value.
    get instanceId() {
        return this._instanceId;
    }

    // Acquire the lock for the given key, or renew its ttl if this instance already
    // owns it. Returns true when this instance is the owner and should handle the event.
    async acquireOrRenew(key, ttlMs) {
        const result = await this._client.eval(ACQUIRE_OR_RENEW_SCRIPT, 1, `${LOCK_PREFIX}:${key}`, this._instanceId, ttlMs);
        return result === 1;
    }

    // Whether the lock key currently exists in Redis, regardless of which instance owns it.
    // Used by the backup check to detect a missing leader when keyspace notifications are
    // unavailable or a notification was missed.
    async exists(key) {
        const result = await this._client.exists(`${LOCK_PREFIX}:${key}`);
        return result === 1;
    }

    // The instanceId currently holding the lock (the lock value), or null when the key is
    // absent. The value equals the owning instance's id, so this reports the elected leader
    // straight from redis - the source of truth for the election.
    async getOwner(key) {
        return this._client.get(`${LOCK_PREFIX}:${key}`);
    }

    // Subscribe to keyspace notifications for the lock key and invoke onGone(event) as soon as
    // the key is deleted or expires. A dedicated subscriber connection is used because a Redis
    // connection in subscribe mode cannot run other commands. Best-effort: when keyspace
    // notifications cannot be enabled the periodic backup check still drives failover.
    async watchKeyRemoval(key, onGone) {
        const fullKey = `${LOCK_PREFIX}:${key}`;
        const db = (this._client.options && this._client.options.db) || 0;
        const channel = `__keyspace@${db}__:${fullKey}`;
        await this._enableKeyspaceNotifications();
        this._subscriber = Factory.getClient(this._redisOptions);
        this._subscriber.on('error', (error) => {
            this._log.throttle.warning(`leader key subscriber error: ${error.message}`, { component });
        });
        this._subscriber.on('message', (incomingChannel, event) => {
            if (incomingChannel === channel && KEY_GONE_EVENTS.includes(event)) {
                this._log.info(`leader key '${fullKey}' is gone (${event} event)`, { component });
                onGone(event);
            }
        });
        await this._subscriber.subscribe(channel);
        this._log.info(`subscribed to leader key notifications on '${channel}'`, { component });
    }

    // Ensure Redis emits the keyspace events we need, merging with any existing flags so we do
    // not disable notifications other components rely on.
    async _enableKeyspaceNotifications() {
        try {
            const current = await this._client.config('GET', 'notify-keyspace-events');
            const flags = (current && current[1]) || '';
            const merged = KEYSPACE_EVENT_FLAGS.reduce((acc, flag) => (acc.includes(flag) ? acc : acc + flag), flags);
            if (merged !== flags) {
                await this._client.config('SET', 'notify-keyspace-events', merged);
                this._log.info(`enabled redis keyspace notifications '${merged}' (was '${flags}')`, { component });
            }
        }
        catch (error) {
            this._log.warning(`could not enable redis keyspace notifications, relying on backup leader check: ${error.message}`, { component });
        }
    }
}

const redisLock = new RedisLock();
redisLock.LEADER_KEY = LEADER_KEY;
module.exports = redisLock;
