
const { expect } = require('chai');
const { generateArr, stubTemplate } = require('./stub/stub');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const bootstrap = require('../bootstrap');
let config, queuesManager, queueRunner;
const algorithmName = 'green-alg'
let _semaphore = null;
let queue = null;

const heuristic = score => job => ({ ...job, ...{ calculated: { enrichment: { batchIndex: {} }, score, entranceTime: Date.now(), latestScore: {} } } });
const heuristicBoilerPlate = (score, _heuristic) => _heuristic(score);

describe('Test', () => {
    before(async () => {
        config = await bootstrap.init();
        queuesManager = require('../lib/queues-manager');
        queueRunner = require('../lib/queue-runner');
    });
    beforeEach(async () => {
        queue = queueRunner.create({ options: config, algorithmName })
        await queue.start({ options: config, algorithmName });
        _semaphore = new semaphore();
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
            describe('add', () => {
                it('should added to queue', async () => {
                    queue.scoreHeuristic = heuristicBoilerPlate(80, heuristic);
                    await queue.addJobs([stubTemplate()]);
                    await queue._pushQueueInterval();
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                });
                it('should added to queue ordered', async () => {
                    queue.scoreHeuristic = heuristic(80);
                    await queue.addJobs([stubTemplate()]);
                    queue.scoreHeuristic = heuristic(60);
                    await queue.addJobs([stubTemplate()]);
                    queue.scoreHeuristic = heuristic(90);
                    await queue.addJobs([stubTemplate()]);
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                });
            });
            describe('remove', () => {
                it('should removed from queue', async () => {
                    queue.scoreHeuristic = heuristic(80);
                    const stubJob = stubTemplate();
                    await queue.addJobs([stubJob]);
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
                    queue.scoreHeuristic = heuristic(80);
                    const stubJob = stubTemplate();
                    await queue.addJobs([stubJob]);
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
                    queue.scoreHeuristic = heuristic(80);
                    const stubJob = stubTemplate();
                    await queue.addJobs([stubJob]);
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
                it.skip('check-that-heuristics-sets-to-latestScore', async () => {
                    const stubJob = stubTemplate();
                    await queue.addJobs([stubJob]);
                    await queue._pushQueueInterval();
                    await queue._pushQueueInterval();
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
                    queue.scoreHeuristic = heuristic(80);
                    await queue.addJobs([stubTemplate()]);
                    await _semaphore.done();
                });
                it('check events remove', async () => {
                    queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                    queue.scoreHeuristic = heuristic(80);
                    const stubJob = stubTemplate();
                    await queue.addJobs([stubJob]);
                    await queue.removeJobs([{ jobId: stubJob.jobId }]);
                    await _semaphore.done();
                });
            });
        });
    });
    describe('persistency tests', () => {
        it('persistent load', async () => {
            queue.flush()
            const arr = generateArr(100);
            await queue.addJobs(arr);
            await queue.persistenceStore();
            queue.flush();
            await queue.persistencyLoad();
            const q = queue.get;
            expect(q.length).to.be.eql(100);
        });
    });
    describe('test jobs order', () => {
        it('order 100', async () => {
            queue.flush()
            await queue.addJobs(generateArr(100));
            const q = queue.get;
            expect(q.length).to.be.eql(100);
        });
    });
});

