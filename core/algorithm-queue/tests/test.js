
const { expect } = require('chai');
const { generateArr, stubTemplate } = require('./stub/stub');
const delay = require('await-delay');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const bootstrap = require('../bootstrap');
const queuesManager = require('../lib/queues-manager');
const queueRunner = require('../lib/queue-runner');
let config;
const algorithmName = 'green-alg'
const QUEUE_INTERVAL = 500;

const heuristic = score => job => ({ ...job, ...{ calculated: { score, entranceTime: Date.now(), latestScore: {} } } });
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});

describe('Test', () => {
    before(async () => {
        config = await bootstrap.init();
    });
    describe('algorithm queue', () => {
        it('should add queue to list', async () => {
            const job = {
                data: { algorithmName: 'green-alg', action: 'add' },
                done: () => { }
            }
            await queuesManager._handleJob(job);
            expect(queuesManager._queues).to.have.length(1);
        });
        it('should not reach the max queues limit', async () => {
            const limit = 5;
            await Promise.all(Array.from(Array(limit * 4).keys()).map(async a => {
                const job = {
                    data: { algorithmName: `alg-${a}`, action: 'add' },
                    done: () => { }
                }
                await queuesManager._handleJob(job);
            }));
            expect(queuesManager._queues.size).to.eql(limit);
        });
    });
    describe('algorithm queue', () => {
        describe('queue-tests', () => {
            let _semaphore = null;
            let queue = null;
            beforeEach(async () => {
                queue = queueRunner.create({ options: config, algorithmName })
                await queue.start({ options: config, algorithmName });
                _semaphore = new semaphore();
            });
            describe('add', () => {
                it('should added to queue', async () => {
                    queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                    queue.add([stubTemplate()]);
                    await delay(QUEUE_INTERVAL + 500);
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                });
                it('should added to queue ordered', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(60) });
                    queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(90) });
                    queue.add([stubTemplate()]);
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                    queue.intervalRunningStatus = false;
                });
            });
            describe('remove', () => {
                it('should removed from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.removeJobs([{ jobId: stubJob.jobId }]);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(0);
                });
                it('should not removed from queue when there is no matched id', async () => {
                    let called = false;
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        called = true;
                    });
                    queue.removeJobs([{ jobId: '111222333' }]);
                    expect(called).to.equal(false);
                    const q = queue.get;
                    expect(q).to.have.length(1);
                    expect(q[0].jobId).to.be.eql(stubJob.jobId);
                });
            });
            describe('pop', () => {
                it('should pop from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add([stubJob]);
                    queue.on(queueEvents.POP, () => {
                        _semaphore.callDone();
                    });
                    const job = queue.tryPop();
                    await _semaphore.done({ doneAmount: 1 });
                    const q = queue.get;
                    expect(job.jobId).to.be.eql(stubJob.jobId);
                    expect(q).to.have.length(0);
                });
            });
            describe('queue-runner', () => {
                it.only('check-that-heuristics-sets-to-latestScore', async () => {
                    const stubJob = stubTemplate();
                    queue.add([stubJob]);
                    await queue._intervalUpdateCallback();
                    await queue._intervalUpdateCallback();
                    const q = queue.get;
                    expect(q[0].calculated.latestScores).to.have.property('BATCH');
                    expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
                    expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
                    expect(q[0].calculated.score).to.be.above(0);
                });
            });
            describe('queue-events', () => {
                it('check events insert', async () => {
                    queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    queue.add([stubTemplate()]);
                    await _semaphore.done();
                });
                it('check events remove', async () => {
                    queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    const stubJob = stubTemplate();
                    queue.add([stubJob]);
                    await queue.removeJobs([{ jobId: stubJob.jobId }]);
                    await _semaphore.done();
                });
            });
            afterEach(() => {
                queue.intervalRunningStatus = false;
            });
            after(() => {
                queue.flush();
            });
        });
    });
    describe('persistency tests', () => {
        let queue = null;
        beforeEach(async () => {
            queue = queueRunner.create({ options: config, algorithmName })
            await queue.start({ options, algorithmName });
        });
        it('persistent load', async () => {
            queue.flush()
            const arr = generateArr(100);
            queue.add(arr);
            await queue.persistenceStore();
            queue.flush();
            await queue.persistencyLoad();
            const q = queue.get;
            expect(q.length).to.be.eql(100);
            expect(q.map(i => i.jobId)).to.be.eql(arr.map(i => i.jobId));
            await queue.persistenceStore();
            queue.flush();
            await queue.persistenceStore();
        });
    });
    describe('test jobs order', () => {
        it('order 100', async () => {
            queue.flush()
            queue.add(generateArr(100));
            const q = queue.get;
            expect(q.length).to.be.eql(100);
        });
    });
    afterEach(() => {

    });
});

