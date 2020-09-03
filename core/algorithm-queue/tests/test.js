
const { expect } = require('chai');
const { generateArr, stubTemplate } = require('./stub/stub');
const delay = require('await-delay');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const bootstrap = require('../bootstrap');
const queueRunner = require('../lib/queue-runner');
const persistence = require('../lib/persistency/persistence');
const heuristicList = require('../lib/heuristic/index');

const EnrichmentRunner = require('../lib/enrichment-runner');
const HeuristicRunner = require('../lib/heuristic-runner')
let Queue = null;

const heuristic = score => job => (Promise.resolve({ ...job, ...{ calculated: { score, entranceTime: Date.now(), latestScore: {} } } }));
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});
let queue = null;
const QUEUE_INTERVAL = 500;

describe('Test', () => {
    before(async () => {
        await bootstrap.init();
    });
    describe('algorithm queue', () => {
        describe('queue-tests', () => {
            describe('add', () => {
                beforeEach(() => {
                    Queue = require('../lib/queue');
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                });
                it('should added to queue', async () => {
                    queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                    await queue.add([stubTemplate()]);
                    await delay(QUEUE_INTERVAL + 500);
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                }).timeout(5000);
                it('should added to queue ordered', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(60) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(90) });
                    await queue.add([stubTemplate()]);
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                    queue.intervalRunningStatus = false;
                }).timeout(5000);
            });
            describe('remove', () => {
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue');
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('should removed from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.removeJobs([{ jobId: stubJob.jobId }]);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(0);
                }).timeout(50000);
                it('should not removed from queue when there is no matched id', async () => {
                    let called = false;
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
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
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue');
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('should pop from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
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
                beforeEach(() => {
                    Queue = require('../lib/queue');
                    const scoreHeuristic = new HeuristicRunner()
                    const heuristicsWeights = {
                        ['ATTEMPTS']: 0.2,
                        ['PRIORITY']: 0.4,
                        ['ENTRANCE_TIME']: 0.2,
                        ['BATCH']: 0.1,
                        ['CURRENT_BATCH_PLACE']: 0.1
                    };
                    scoreHeuristic.init(heuristicsWeights);
                    Object.values(heuristicList).map(v => scoreHeuristic.addHeuristicToQueue(v));
                    queue = new Queue({ persistence, updateInterval: 99999, enrichmentRunner: new EnrichmentRunner(), scoreHeuristic });
                });
                it('check-that-heuristics-sets-to-latestScore', async () => {
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
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
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue');
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('check events insert', async () => {
                    queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    await queue.add([stubTemplate()]);
                    await _semaphore.done();
                });
                it('check events remove', async () => {
                    queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    await queue.removeJobs([{ jobId: stubJob.jobId }]);
                    await _semaphore.done();
                });
                afterEach(() => {
                    queue.intervalRunningStatus = false;
                });
                after(() => {
                    queue.flush();
                });
            });
        });
    });
    describe('persistency tests', () => {
        beforeEach(() => {
            Queue = require('../lib/queue');
            queue = new Queue({ persistence, updateInterval: 99999, enrichmentRunner: new EnrichmentRunner(), scoreHeuristic: new HeuristicRunner() });

        });
        it('persistent load', async () => {
            queue.flush()
            const arr = generateArr(100);
            await queue.add(arr);
            await queue.persistenceStore();
            queue.flush();
            await queue.persistencyLoad();
            const q = queue.get;
            expect(q.length).to.be.eql(100);
            expect(q.map(i=>i.jobId)).to.be.eql(arr.map(i=>i.jobId));
            await queue.persistenceStore();
            queue.flush();
            await queue.persistenceStore();
        });
    });
    describe('test jobs order', () => {
        it('order 100', async () => {
            queue.flush()
            await queue.add(generateArr(100));
            const q = queue.get;
            expect(q.length).to.be.eql(100);
        });
    });
    afterEach(() => {
        queue.flush();
    });
});

