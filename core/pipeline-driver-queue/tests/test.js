const { expect } = require('chai');
const delay = require('await-delay');
const { generateArr, stubTemplate } = require('./stub/stub');
const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const { pipelines } = require('./mock/index');
let bootstrap = require('../bootstrap');
const queueRunner = require('../lib/queue-runner');
const persistence = require('../lib/persistency/persistence');
const setting = { prefix: 'pipeline-driver-queue' }
const producer = new Producer({ setting });
const heuristic = score => job => (Promise.resolve({ ...job, entranceTime: Date.now(), ...{ calculated: { score, latestScore: {} } } }));
const Queue = require('../lib/queue');
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
                it('should added to queue', async () => {
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL });
                    queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                    await queue.add([stubTemplate()]);
                    await delay(QUEUE_INTERVAL + 500);
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                });
                it('should added to queue ordered', async () => {
                    queue = new Queue({ updateInterval: 10000 });
                    queue.updateHeuristic({ run: heuristic(80) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(60) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(90) });
                    await queue.add([stubTemplate()]);
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                    queue.intervalRunningStatus = false;
                });
            });
            describe('remove', () => {
                let _semaphore = null;
                beforeEach(() => {
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL });
                    _semaphore = new semaphore();
                });
                it('should removed from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.remove([stubJob.jobId]);
                    //  await delay(QUEUE_INTERVAL + 500);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(0);
                });
                it('should not removed from queue when there is no matched id', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.remove(['111222333']);
                    //  await delay(QUEUE_INTERVAL + 500);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(1);
                    expect(q[0].jobId).to.be.eql(stubJob.jobId);
                });
            });
            describe('pop', () => {
                let _semaphore = null;
                beforeEach(() => {
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL });
                    _semaphore = new semaphore();
                });
                it('should pop from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.POP, () => {
                        _semaphore.callDone();
                    });
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    const job = queue.tryPop();
                    //  await delay(QUEUE_INTERVAL + 500);
                    await _semaphore.done({ doneAmount: 2 });
                    const q = queue.get;
                    expect(job.jobId).to.be.eql(stubJob.jobId);
                    expect(q).to.have.length(0);
                });
            });
            describe('queue-events', () => {
                let _semaphore = null;
                beforeEach(() => {
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL });
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
                    await queue.remove([stubJob.jobId]);
                    await _semaphore.done();
                });
                afterEach(() => {
                    queue.intervalRunningStatus = false;
                });
            });
        });
        describe('queue-runner', () => {
            it('check-that-heuristics-sets-to-latestScore', async () => {
                //  queue.updateHeuristic(heuristic(80));
                const stubJob = stubTemplate();
                await queueRunner.queue.add([stubJob]);
                await delay(500);
                const q = queueRunner.queue.get;
                expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
                expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
                expect(q[0].calculated.score).to.be.above(0);
            });
        });
    });
    describe('persistency tests', () => {
        it('persistent load', async () => {
            queueRunner.queue.flush()
            await queueRunner.queue.add(generateArr(100));
            await queueRunner.queue.persistenceStore();
            queueRunner.queue.flush();
            await queueRunner.queue.persistencyLoad();
            await delay(500);
            const q = queueRunner.queue.get;
            expect(q.length).to.be.greaterThan(98);
        });
    });
    describe('job-consume', () => {
        it('persistent load', async () => {
            const jobId = uuidv4();
            await persistence.setExecution({ jobId, data: pipelines[0] });
            const options = {
                job: {
                    type: 'pipeline-job',
                    data: {
                        jobId
                    }
                }
            };
            await producer.createJob(options);
            await delay(1500);
        });
    });
    afterEach(() => {
        queueRunner.queue.flush();
    });
});

