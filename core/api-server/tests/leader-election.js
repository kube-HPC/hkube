const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const { buildStatuses } = require('@hkube/consts');
const { request, delay } = require('./utils');
const stateManagerSingleton = require('../lib/state/state-manager');
const leaderElectionSingleton = require('../lib/leader-election/leader-election');
const redisLock = require('../lib/leader-election/redis-lock');

const StateManager = stateManagerSingleton.constructor;
const LeaderElection = leaderElectionSingleton.constructor;

const waitFor = async (predicate, { timeout = 8000, interval = 50 } = {}) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        // eslint-disable-next-line no-await-in-loop
        if (await predicate()) {
            return true;
        }
        // eslint-disable-next-line no-await-in-loop
        await delay(interval);
    }
    return false;
};

describe('Leader Election', () => {
    // Runs before any unit test stubs the shared redisLock, so the live single
    // instance is cleanly the elected leader at this point. Note: the test harness
    // (setup.js) wipes etcd after registration, so the etcd-derived `instances`/
    // `etcdLeader` fields are not populated here - that enumeration is covered by the
    // getLeaderElectionStatus unit tests below. The redis lock is the election source
    // of truth and survives, so it is what we assert end-to-end.
    describe('GET /internal/v1/leader', () => {
        let internalUrl;
        before(() => {
            internalUrl = global.testParams.internalUrl;
        });
        it('should return the leader election status shape', async () => {
            const { body, response } = await request({ uri: `${internalUrl}/leader`, method: 'GET' });
            expect(response.statusCode).to.equal(200);
            expect(body).to.have.all.keys('current', 'etcdLeader', 'redisLeader', 'instances');
            expect(body.current).to.be.a('string');
            expect(body.instances).to.be.an('array');
        });
        it('should elect the single running instance as leader (redis source of truth)', async () => {
            const { body } = await request({ uri: `${internalUrl}/leader`, method: 'GET' });
            expect(body.redisLeader).to.equal(body.current);
        });
    });

    describe('healthcheck reset wiring', () => {
        // The state-manager subscribes to the leader-election service's 'leadership-lost'
        // event (in init) and clears its per-term stuck-job strike count. Assert that live
        // wiring, then restore the count so later assertions are unaffected.
        it('should reset the state-manager failed-healthcheck count on leadership-lost', () => {
            const original = stateManagerSingleton._failedHealthcheckCount;
            stateManagerSingleton._failedHealthcheckCount = 3;
            leaderElectionSingleton.emit('leadership-lost');
            expect(stateManagerSingleton._failedHealthcheckCount).to.equal(0);
            stateManagerSingleton._failedHealthcheckCount = original;
        });
    });

    describe('leader-election service', () => {
        let le;
        let sandbox;
        const leaderConfig = { lockTtl: 2500, renewInterval: 1000, backupInterval: 5000, jitter: 250 };

        // Pause the live instance's renewal/backup loops for the duration of these unit
        // tests, since they stub the shared redisLock singleton. The live redis leader key
        // keeps its ttl (these tests run well under lockTtl), so leadership is never lost.
        before(() => {
            clearInterval(leaderElectionSingleton._leaderRenewalInterval);
            clearInterval(leaderElectionSingleton._leaderBackupInterval);
        });

        after(async () => {
            leaderElectionSingleton._leaderRenewalInterval = setInterval(
                () => leaderElectionSingleton._leaderHeartbeat(),
                leaderElectionSingleton._leaderElection.renewInterval
            );
            leaderElectionSingleton._leaderRenewalInterval.unref();
            leaderElectionSingleton._leaderBackupInterval = setInterval(
                () => leaderElectionSingleton._backupLeaderCheck(),
                leaderElectionSingleton._leaderElection.backupInterval
            );
            leaderElectionSingleton._leaderBackupInterval.unref();
            // Make sure leadership is healthy again before later test files rely on it.
            const ok = await waitFor(() => leaderElectionSingleton.isLeader());
            expect(ok).to.be.true;
        });

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            le = new LeaderElection();
            le._leaderElection = { ...leaderConfig };
            le._options = { serviceName: 'api-server' };
        });

        afterEach(() => {
            sandbox.restore();
        });

        describe('isLeader', () => {
            it('should be false by default', () => {
                expect(le.isLeader()).to.be.false;
            });
            it('should be true when _isLeader is exactly true', () => {
                le._isLeader = true;
                expect(le.isLeader()).to.be.true;
            });
            it('should be false for truthy non-boolean values', () => {
                le._isLeader = 1;
                expect(le.isLeader()).to.be.false;
            });
        });

        describe('_renewLeadership', () => {
            it('should become leader when the lock is acquired', async () => {
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                await le._renewLeadership('test');
                expect(le.isLeader()).to.be.true;
            });
            it('should stay follower when the lock is held by another instance', async () => {
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(false);
                await le._renewLeadership('test');
                expect(le.isLeader()).to.be.false;
            });
            it('should emit leadership-lost when losing leadership', async () => {
                le._isLeader = true;
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(false);
                const spy = sandbox.spy();
                le.on('leadership-lost', spy);
                await le._renewLeadership('test');
                expect(le.isLeader()).to.be.false;
                expect(spy.calledOnce).to.be.true;
            });
            it('should preserve the last known leadership when the lock call throws', async () => {
                le._isLeader = true;
                sandbox.stub(redisLock, 'acquireOrRenew').rejects(new Error('redis down'));
                await le._renewLeadership('test');
                expect(le.isLeader()).to.be.true;
            });
        });

        describe('_leaderHeartbeat', () => {
            it('should not renew when this instance is not the leader', async () => {
                const renew = sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                le._isLeader = false;
                await le._leaderHeartbeat();
                expect(renew.called).to.be.false;
            });
            it('should renew when this instance is the leader', async () => {
                const renew = sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                le._isLeader = true;
                await le._leaderHeartbeat();
                expect(renew.calledOnce).to.be.true;
            });
        });

        describe('_backupLeaderCheck', () => {
            it('should schedule an election when the leader key is missing', async () => {
                sandbox.stub(redisLock, 'exists').resolves(false);
                const schedule = sandbox.stub(le, '_scheduleElection');
                await le._backupLeaderCheck();
                expect(schedule.calledOnce).to.be.true;
            });
            it('should not schedule an election when the leader key exists', async () => {
                sandbox.stub(redisLock, 'exists').resolves(true);
                const schedule = sandbox.stub(le, '_scheduleElection');
                await le._backupLeaderCheck();
                expect(schedule.called).to.be.false;
            });
        });

        describe('_scheduleElection', () => {
            it('should coalesce repeated triggers into a single election', async () => {
                const renew = sandbox.stub(le, '_renewLeadership').resolves();
                le._leaderElection.jitter = 10;
                le._scheduleElection('a');
                le._scheduleElection('b');
                le._scheduleElection('c');
                expect(le._electionScheduled).to.be.true;
                await delay(40);
                expect(renew.calledOnce).to.be.true;
                expect(le._electionScheduled).to.be.false;
            });
            it('should allow a new election after the previous one ran', async () => {
                const renew = sandbox.stub(le, '_renewLeadership').resolves();
                le._leaderElection.jitter = 5;
                le._scheduleElection('first');
                await delay(25);
                le._scheduleElection('second');
                await delay(25);
                expect(renew.calledTwice).to.be.true;
            });
        });

        describe('getLeaderElectionStatus', () => {
            it('should report current, etcd leader, redis leader and all instances', async () => {
                le._instanceId = 'inst-current';
                le._etcd = {
                    discovery: {
                        keys: sandbox.stub().resolves(['/discovery/api-server/inst-a', '/discovery/api-server/inst-current']),
                        get: sandbox.stub().callsFake(async ({ instanceId }) => ({ isLeader: instanceId === 'inst-a' })),
                    },
                };
                sandbox.stub(redisLock, 'getOwner').resolves('inst-a');

                const status = await le.getLeaderElectionStatus();
                expect(status.current).to.equal('inst-current');
                expect(status.etcdLeader).to.equal('inst-a');
                expect(status.redisLeader).to.equal('inst-a');
                expect(status.instances).to.have.lengthOf(2);
                expect(status.instances.find((i) => i.isLeader).instanceId).to.equal('inst-a');
            });
            it('should report null leaders when no instance owns the lock', async () => {
                le._instanceId = 'inst-current';
                le._etcd = {
                    discovery: {
                        keys: sandbox.stub().resolves(['/discovery/api-server/inst-a']),
                        get: sandbox.stub().resolves({ isLeader: false }),
                    },
                };
                sandbox.stub(redisLock, 'getOwner').resolves(null);

                const status = await le.getLeaderElectionStatus();
                expect(status.etcdLeader).to.be.null;
                expect(status.redisLeader).to.be.null;
            });
        });
    });

    describe('state-manager leader gating', () => {
        let sm;
        let sandbox;

        // Leadership now lives in the leader-election service; inject a standalone instance
        // so toggling its flag drives the state-manager's leader-only gates in isolation.
        beforeEach(() => {
            sandbox = sinon.createSandbox();
            sm = new StateManager();
            sm._leaderElection = new LeaderElection();
            sm._options = { serviceName: 'api-server', healthchecks: { checkInterval: 5000, minAge: 10000 } };
        });

        afterEach(() => {
            sandbox.restore();
        });

        const setLeader = (value) => {
            sm._leaderElection._isLeader = value;
        };

        describe('_emitJobResultChange', () => {
            it('should emit job-result-change when leader', () => {
                setLeader(true);
                const spy = sandbox.spy();
                sm.on('job-result-change', spy);
                sm._emitJobResultChange({ jobId: 'j1' });
                expect(spy.calledOnce).to.be.true;
                expect(spy.firstCall.args[0]).to.eql({ jobId: 'j1' });
            });
            it('should not emit job-result-change when not leader', () => {
                setLeader(false);
                const spy = sandbox.spy();
                sm.on('job-result-change', spy);
                sm._emitJobResultChange({ jobId: 'j1' });
                expect(spy.called).to.be.false;
            });
        });

        describe('onJobStatus gating', () => {
            it('should invoke the handler only when leader', () => {
                sm._etcd = { jobs: { status: new EventEmitter() } };
                const spy = sandbox.spy();
                sm.onJobStatus(spy);

                setLeader(false);
                sm._etcd.jobs.status.emit('change', { jobId: 'j1' });
                expect(spy.called).to.be.false;

                setLeader(true);
                sm._etcd.jobs.status.emit('change', { jobId: 'j2' });
                expect(spy.calledOnce).to.be.true;
                expect(spy.firstCall.args[0]).to.eql({ jobId: 'j2' });
            });
        });

        describe('onBuildComplete gating', () => {
            it('should invoke the handler only when leader and the build completed', () => {
                sm._etcd = { algorithms: { builds: new EventEmitter() } };
                const spy = sandbox.spy();
                sm.onBuildComplete(spy);

                // not leader -> ignored even if completed
                setLeader(false);
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.COMPLETED });
                expect(spy.called).to.be.false;

                // leader but not completed -> ignored
                setLeader(true);
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.ACTIVE });
                expect(spy.called).to.be.false;

                // leader and completed -> invoked
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.COMPLETED });
                expect(spy.calledOnce).to.be.true;
            });
        });

        describe('_healthcheckInterval gating', () => {
            it('should skip stuck-job detection and re-arm when not leader', async () => {
                setLeader(false);
                const getJobs = sandbox.stub(sm, 'getNotCompletedJobs').resolves([]);
                const rearm = sandbox.stub(sm, '_healthcheck');
                await sm._healthcheckInterval();
                expect(getJobs.called).to.be.false;
                expect(rearm.calledOnce).to.be.true;
            });
            it('should run stuck-job detection when leader', async () => {
                setLeader(true);
                const getJobs = sandbox.stub(sm, 'getNotCompletedJobs').resolves([]);
                sandbox.stub(sm, '_healthcheck');
                await sm._healthcheckInterval();
                expect(getJobs.calledOnce).to.be.true;
            });
            it('should emit a result change and bump the failed count for stuck completed jobs', async () => {
                setLeader(true);
                sm._options.healthchecks.minAge = 10;
                sandbox.stub(sm, 'getNotCompletedJobs').resolves([
                    { jobId: 'stuck', result: { timestamp: Date.now() - 100000, status: 'completed' }, status: { status: 'completed' } },
                ]);
                sandbox.stub(sm, '_healthcheck');
                const emit = sandbox.stub(sm, '_emitJobResultChange');
                await sm._healthcheckInterval();
                expect(emit.calledOnce).to.be.true;
                expect(sm._failedHealthcheckCount).to.equal(1);
            });
            it('should not flag fresh completed jobs younger than minAge', async () => {
                setLeader(true);
                sm._options.healthchecks.minAge = 60000;
                sandbox.stub(sm, 'getNotCompletedJobs').resolves([
                    { jobId: 'fresh', result: { timestamp: Date.now(), status: 'completed' }, status: { status: 'completed' } },
                ]);
                sandbox.stub(sm, '_healthcheck');
                const emit = sandbox.stub(sm, '_emitJobResultChange');
                await sm._healthcheckInterval();
                expect(emit.called).to.be.false;
                expect(sm._failedHealthcheckCount).to.equal(0);
            });
        });
    });
});
