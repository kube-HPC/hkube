const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const { uuid } = require('@hkube/uid');
const leaderComponent = require('../consts/componentNames').LEADER_ELECTION;
const redisLock = require('../utils/redis-lock');

let log;

// Dedicated leader-election service. Owns the distributed leader lock and all failover
// mechanics for the api-server. Its init is driven by the state-manager (see state-manager.init),
// which also injects the etcd client once it is created. Emits 'leadership-lost' when this
// instance stops being the leader, so leader-only consumers can reset per-term state.
class LeaderElection extends EventEmitter {
    constructor() {
        super();
        this._isLeader = false;
        this._electionScheduled = false;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._leaderElection = options.leaderElection;
        // Single instance id shared by the redis leader lock and the etcd discovery
        // registration, so the leader lock value matches this api-server's etcd register name.
        this._instanceId = uuid();
        redisLock.init(options, this._instanceId);
        await this._initLeaderElection();
    }

    // The etcd client is created by the state-manager after the initial election, so it is
    // injected here once available. Until then, discovery updates are a no-op (the initial
    // registration done by the state-manager already carries the leadership flag).
    setEtcd(etcd) {
        this._etcd = etcd;
    }

    // Stable per-process owner id, shared with the etcd discovery registration so the lock
    // value matches this api-server's etcd register name.
    get instanceId() {
        return this._instanceId;
    }

    // Distributed leader election. On init every instance runs one election; whichever wins
    // owns the leader key. The leader then renews the key TTL on a fixed heartbeat (every
    // renewInterval), so leadership stays stable and does not depend on event traffic.
    // Failover, when the leader stops renewing and its key disappears, is driven two ways:
    //   1. fast path - a Redis keyspace notification (del/expired) on the key triggers an
    //      election immediately.
    //   2. backup    - a periodic existence check (every backupInterval) triggers an election
    //      when the key is missing, covering environments where keyspace notifications are
    //      unavailable or a notification was missed.
    // Each election waits a small random jitter before acquiring, to spread concurrent
    // attempts from multiple instances.
    async _initLeaderElection() {
        const { lockTtl, renewInterval, backupInterval, jitter } = this._leaderElection;
        log.info(`starting leader election (lockTtl: ${lockTtl}ms, renewInterval: ${renewInterval}ms, backupInterval: ${backupInterval}ms, jitter: ${jitter}ms)`, { component: leaderComponent });

        // Initial election on init.
        await this._renewLeadership('init');

        // Heartbeat: the current leader keeps renewing the key TTL.
        this._leaderRenewalInterval = setInterval(() => this._leaderHeartbeat(), renewInterval);
        this._leaderRenewalInterval.unref();

        // Backup safety net: re-elect if the leader key is gone.
        this._leaderBackupInterval = setInterval(() => this._backupLeaderCheck(), backupInterval);
        this._leaderBackupInterval.unref();

        // Fast path: react to del/expired keyspace notifications on the leader key.
        try {
            await redisLock.watchKeyRemoval(redisLock.LEADER_KEY, (event) => this._scheduleElection(`keyspace-${event}`));
        }
        catch (error) {
            log.warning(`failed to subscribe to leader key notifications, using backup check only: ${error.message}`, { component: leaderComponent });
        }
    }

    // Heartbeat tick: only the leader renews. Followers stay idle here and rely on the
    // keyspace notification or the backup check to elect when the leader key disappears.
    async _leaderHeartbeat() {
        if (!this._isLeader) {
            return;
        }
        await this._renewLeadership('heartbeat');
    }

    // Acquire the leader key, or renew its TTL if already owned, and log leadership changes.
    async _renewLeadership(reason) {
        try {
            const wasLeader = this._isLeader;
            this._isLeader = await redisLock.acquireOrRenew(redisLock.LEADER_KEY, this._leaderElection.lockTtl);
            if (this._isLeader && !wasLeader) {
                log.info(`became leader (reason: ${reason}, instanceId: ${redisLock.instanceId})`, { component: leaderComponent });
                this._updateLeaderDiscovery();
            }
            else if (!this._isLeader && wasLeader) {
                log.warning(`lost leadership (reason: ${reason})`, { component: leaderComponent });
                // Stuck-job detection is leader-only, so any per-term strikes must be dropped.
                // Otherwise, if this pod is re-elected, stale strikes could trip the healthcheck
                // and restart it prematurely. Notify consumers so they clear per-term state.
                this.emit('leadership-lost');
                this._updateLeaderDiscovery();
            }
        }
        catch (error) {
            log.throttle.warning(`failed to renew leader lock: ${error.message}`, { component: leaderComponent });
        }
    }

    // Backup safety net (every backupInterval): when the leader key is missing, schedule a
    // jittered election so a new leader is elected even if keyspace notifications were missed.
    async _backupLeaderCheck() {
        try {
            const exists = await redisLock.exists(redisLock.LEADER_KEY);
            if (!exists) {
                log.info('backup check: leader key is missing', { component: leaderComponent });
                this._scheduleElection('backup-check');
            }
        }
        catch (error) {
            log.throttle.warning(`backup leader check failed: ${error.message}`, { component: leaderComponent });
        }
    }

    // Run an election after a small random jitter (0..jitter ms) to spread simultaneous
    // attempts across instances, coalescing repeated triggers so only one runs at a time.
    _scheduleElection(reason) {
        if (this._electionScheduled) {
            return;
        }
        this._electionScheduled = true;
        const delay = Math.floor(Math.random() * (this._leaderElection.jitter + 1));
        log.info(`scheduling leader election in ${delay}ms (reason: ${reason})`, { component: leaderComponent });
        setTimeout(() => {
            this._electionScheduled = false;
            this._renewLeadership(`election:${reason}`);
        }, delay).unref();
    }

    // Whether this instance currently holds the distributed leader lock.
    isLeader() {
        return this._isLeader === true;
    }

    // Publish the current leadership flag to this instance's etcd discovery record, so leader
    // status is easy to inspect (e.g. discovery list shows which pod is the leader). Fire-and-
    // forget: this is debug-only visibility and must not block or fail the election path. No-op
    // until etcd is injected; the initial registration by the state-manager already carries the flag.
    _updateLeaderDiscovery() {
        if (!this._etcd) {
            return;
        }
        this._etcd.discovery.updateRegisteredData({ ...this._options, isLeader: this._isLeader })
            .catch((error) => {
                log.throttle.warning(`failed to update leader status in discovery: ${error.message}`, { component: leaderComponent });
            });
    }

    // List all api-server instances from etcd discovery and report which one currently holds
    // leadership. The instanceId comes from the discovery key (path /discovery/<service>/<id>)
    // and the isLeader flag from that instance's registered discovery value. Also reports the
    // leader straight from the redis lock (the election source of truth) as redisLeader, so a
    // mismatch with the etcd-derived leader reveals a lagging discovery update.
    async getLeaderElectionStatus() {
        const { serviceName } = this._options;
        const keys = await this._etcd.discovery.keys({ serviceName });
        const instances = await Promise.all((keys || []).map(async (key) => {
            const instanceId = key.split('/').pop();
            const data = await this._etcd.discovery.get({ serviceName, instanceId });
            return { instanceId, isLeader: data?.isLeader === true };
        }));
        const etcdLeader = instances.find(i => i.isLeader)?.instanceId || null;
        const redisLeader = await redisLock.getOwner(redisLock.LEADER_KEY);
        return { current: this._instanceId, etcdLeader, redisLeader, instances };
    }
}

module.exports = new LeaderElection();
