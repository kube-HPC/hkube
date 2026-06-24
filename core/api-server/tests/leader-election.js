const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');
const { buildStatuses } = require('@hkube/consts');
const { request, delay } = require('./utils');
const stateManagerSingleton = require('../lib/state/state-manager');
const redisLock = require('../lib/utils/redis-lock');

const StateManager = stateManagerSingleton.constructor;

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

    describe('state-manager leader logic', () => {
        let sm;
        let sandbox;
        const leaderConfig = { lockTtl: 2500, renewInterval: 1000, backupInterval: 5000, jitter: 250 };

        // Pause the live instance's renewal/backup loops for the duration of these unit
        // tests, since they stub the shared redisLock singleton. The live redis leader key
        // keeps its ttl (these tests run well under lockTtl), so leadership is never lost.
        before(() => {
            clearInterval(stateManagerSingleton._leaderRenewalInterval);
            clearInterval(stateManagerSingleton._leaderBackupInterval);
        });

        after(async () => {
            stateManagerSingleton._leaderRenewalInterval = setInterval(
                () => stateManagerSingleton._leaderHeartbeat(),
                stateManagerSingleton._leaderElection.renewInterval
            );
            stateManagerSingleton._leaderRenewalInterval.unref();
            stateManagerSingleton._leaderBackupInterval = setInterval(
                () => stateManagerSingleton._backupLeaderCheck(),
                stateManagerSingleton._leaderElection.backupInterval
            );
            stateManagerSingleton._leaderBackupInterval.unref();
            // Make sure leadership is healthy again before later test files rely on it.
            const ok = await waitFor(() => stateManagerSingleton.isLeader());
            expect(ok).to.be.true;
        });

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            sm = new StateManager();
            sm._leaderElection = { ...leaderConfig };
            sm._options = { serviceName: 'api-server', healthchecks: { checkInterval: 5000, minAge: 10000 } };
        });

        afterEach(() => {
            sandbox.restore();
        });

        describe('isLeader', () => {
            it('should be false by default', () => {
                expect(sm.isLeader()).to.be.false;
            });
            it('should be true when _isLeader is exactly true', () => {
                sm._isLeader = true;
                expect(sm.isLeader()).to.be.true;
            });
            it('should be false for truthy non-boolean values', () => {
                sm._isLeader = 1;
                expect(sm.isLeader()).to.be.false;
            });
        });

        describe('_renewLeadership', () => {
            it('should become leader when the lock is acquired', async () => {
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                await sm._renewLeadership('test');
                expect(sm.isLeader()).to.be.true;
            });
            it('should stay follower when the lock is held by another instance', async () => {
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(false);
                await sm._renewLeadership('test');
                expect(sm.isLeader()).to.be.false;
            });
            it('should reset the failed-healthcheck count when losing leadership', async () => {
                sm._isLeader = true;
                sm._failedHealthcheckCount = 3;
                sandbox.stub(redisLock, 'acquireOrRenew').resolves(false);
                await sm._renewLeadership('test');
                expect(sm.isLeader()).to.be.false;
                expect(sm._failedHealthcheckCount).to.equal(0);
            });
            it('should preserve the last known leadership when the lock call throws', async () => {
                sm._isLeader = true;
                sandbox.stub(redisLock, 'acquireOrRenew').rejects(new Error('redis down'));
                await sm._renewLeadership('test');
                expect(sm.isLeader()).to.be.true;
            });
        });

        describe('_leaderHeartbeat', () => {
            it('should not renew when this instance is not the leader', async () => {
                const renew = sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                sm._isLeader = false;
                await sm._leaderHeartbeat();
                expect(renew.called).to.be.false;
            });
            it('should renew when this instance is the leader', async () => {
                const renew = sandbox.stub(redisLock, 'acquireOrRenew').resolves(true);
                sm._isLeader = true;
                await sm._leaderHeartbeat();
                expect(renew.calledOnce).to.be.true;
            });
        });

        describe('_backupLeaderCheck', () => {
            it('should schedule an election when the leader key is missing', async () => {
                sandbox.stub(redisLock, 'exists').resolves(false);
                const schedule = sandbox.stub(sm, '_scheduleElection');
                await sm._backupLeaderCheck();
                expect(schedule.calledOnce).to.be.true;
            });
            it('should not schedule an election when the leader key exists', async () => {
                sandbox.stub(redisLock, 'exists').resolves(true);
                const schedule = sandbox.stub(sm, '_scheduleElection');
                await sm._backupLeaderCheck();
                expect(schedule.called).to.be.false;
            });
        });

        describe('_scheduleElection', () => {
            it('should coalesce repeated triggers into a single election', async () => {
                const renew = sandbox.stub(sm, '_renewLeadership').resolves();
                sm._leaderElection.jitter = 10;
                sm._scheduleElection('a');
                sm._scheduleElection('b');
                sm._scheduleElection('c');
                expect(sm._electionScheduled).to.be.true;
                await delay(40);
                expect(renew.calledOnce).to.be.true;
                expect(sm._electionScheduled).to.be.false;
            });
            it('should allow a new election after the previous one ran', async () => {
                const renew = sandbox.stub(sm, '_renewLeadership').resolves();
                sm._leaderElection.jitter = 5;
                sm._scheduleElection('first');
                await delay(25);
                sm._scheduleElection('second');
                await delay(25);
                expect(renew.calledTwice).to.be.true;
            });
        });

        describe('_emitJobResultChange', () => {
            it('should emit job-result-change when leader', () => {
                sm._isLeader = true;
                const spy = sandbox.spy();
                sm.on('job-result-change', spy);
                sm._emitJobResultChange({ jobId: 'j1' });
                expect(spy.calledOnce).to.be.true;
                expect(spy.firstCall.args[0]).to.eql({ jobId: 'j1' });
            });
            it('should not emit job-result-change when not leader', () => {
                sm._isLeader = false;
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

                sm._isLeader = false;
                sm._etcd.jobs.status.emit('change', { jobId: 'j1' });
                expect(spy.called).to.be.false;

                sm._isLeader = true;
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
                sm._isLeader = false;
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.COMPLETED });
                expect(spy.called).to.be.false;

                // leader but not completed -> ignored
                sm._isLeader = true;
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.ACTIVE });
                expect(spy.called).to.be.false;

                // leader and completed -> invoked
                sm._etcd.algorithms.builds.emit('change', { status: buildStatuses.COMPLETED });
                expect(spy.calledOnce).to.be.true;
            });
        });

        describe('_healthcheckInterval gating', () => {
            it('should skip stuck-job detection and re-arm when not leader', async () => {
                sm._isLeader = false;
                const getJobs = sandbox.stub(sm, 'getNotCompletedJobs').resolves([]);
                const rearm = sandbox.stub(sm, '_healthcheck');
                await sm._healthcheckInterval();
                expect(getJobs.called).to.be.false;
                expect(rearm.calledOnce).to.be.true;
            });
            it('should run stuck-job detection when leader', async () => {
                sm._isLeader = true;
                const getJobs = sandbox.stub(sm, 'getNotCompletedJobs').resolves([]);
                sandbox.stub(sm, '_healthcheck');
                await sm._healthcheckInterval();
                expect(getJobs.calledOnce).to.be.true;
            });
            it('should emit a result change and bump the failed count for stuck completed jobs', async () => {
                sm._isLeader = true;
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
                sm._isLeader = true;
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

        describe('getLeaderElectionStatus', () => {
            it('should report current, etcd leader, redis leader and all instances', async () => {
                sm._instanceId = 'inst-current';
                sm._etcd = {
                    discovery: {
                        keys: sandbox.stub().resolves(['/discovery/api-server/inst-a', '/discovery/api-server/inst-current']),
                        get: sandbox.stub().callsFake(async ({ instanceId }) => ({ isLeader: instanceId === 'inst-a' })),
                    },
                };
                sandbox.stub(redisLock, 'getOwner').resolves('inst-a');

                const status = await sm.getLeaderElectionStatus();
                expect(status.current).to.equal('inst-current');
                expect(status.etcdLeader).to.equal('inst-a');
                expect(status.redisLeader).to.equal('inst-a');
                expect(status.instances).to.have.lengthOf(2);
                expect(status.instances.find((i) => i.isLeader).instanceId).to.equal('inst-a');
            });
            it('should report null leaders when no instance owns the lock', async () => {
                sm._instanceId = 'inst-current';
                sm._etcd = {
                    discovery: {
                        keys: sandbox.stub().resolves(['/discovery/api-server/inst-a']),
                        get: sandbox.stub().resolves({ isLeader: false }),
                    },
                };
                sandbox.stub(redisLock, 'getOwner').resolves(null);

                const status = await sm.getLeaderElectionStatus();
                expect(status.etcdLeader).to.be.null;
                expect(status.redisLeader).to.be.null;
            });
        });
    });
});
