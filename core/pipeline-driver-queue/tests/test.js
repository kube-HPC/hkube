const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('await-delay');
const { generateArr, stubTemplate } = require('./stub/stub');
const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
let consumer;
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const { pipelines } = require('./mock/index');
const bootstrap = require('../bootstrap');
const queueRunner = require('../lib/queue-runner');
const persistence = require('../lib/persistency/persistence');
const setting = { prefix: 'pipeline-driver-queue' }
const producer = new Producer({ setting });
const Queue = require('../lib/queue');

const heuristic = score => job => ({ ...job, entranceTime: Date.now(), ...{ calculated: { score, latestScore: {} } } });
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
        consumer = require('../lib/jobs/consumer');
    });
    let _semaphore = null;
    beforeEach(() => {
        queue = new Queue({ updateInterval: QUEUE_INTERVAL });
        _semaphore = new semaphore();
    });
    describe('algorithm queue', () => {
        describe('queue-tests', () => {
            describe('add', () => {
                it('should added to queue', async () => {
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL });
                    queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                    queue.add(stubTemplate());
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                });
                xit('should added to queue ordered', async () => {
                    queue = new Queue({ updateInterval: 10000 });
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.add(stubTemplate());
                    queue.updateHeuristic({ run: heuristic(60) });
                    queue.add(stubTemplate());
                    queue.updateHeuristic({ run: heuristic(90) });
                    queue.add(stubTemplate());
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                });
            });
            describe('remove', () => {
                it('should removed from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add(stubJob);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.remove(stubJob.jobId);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(0);
                });
                it('should not removed from queue when there is no matched id', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add(stubJob);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.remove('111222333');
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(1);
                    expect(q[0].jobId).to.be.eql(stubJob.jobId);
                });
            });
            describe('pop', () => {
                it('should pop from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add(stubJob);
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
            describe('queue-events', () => {
                it('check events insert', async () => {
                    queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.add(stubTemplate());
                    await _semaphore.done();
                });
                it('check events remove', async () => {
                    queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    queue.add(stubJob);
                    await queue.remove(stubJob.jobId);
                    await _semaphore.done();
                });
            });
        });
        describe('queue-runner', () => {
            it('check-that-heuristics-sets-to-latestScore', async () => {
                const stubJob = stubTemplate();
                queueRunner.queue.add(stubJob);
                const q = queueRunner.queue.get;
                expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
                expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
                expect(q[0].calculated.score).to.be.above(0);
            });
        });
    });
    describe('persistency tests', () => {
        it('persistent load', async () => {
            queueRunner.queue.queue = []
            const jobs = generateArr(100);
            jobs.forEach(j => queueRunner.queue.add(j))
            await queueRunner.queue.persistenceStore();
            queueRunner.queue.queue = [];
            await queueRunner.queue.persistencyLoad();
            const q = queueRunner.queue.get;
            expect(q.length).to.be.greaterThan(98);
        });
    });
    describe('job-consume', () => {
        it('should consume job with params', async () => {
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
            const spy = sinon.spy(consumer, "_handleJob");
            await producer.createJob(options);
            await delay(1000);

            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].data.jobId).to.equal(jobId);

        });
    });
    afterEach(() => {
        queueRunner.queue.queue = [];
    });
});

