const { expect } = require('chai');
const delay = require('await-delay');
const { stubTemplate } = require('./stub/stub');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const queueRunner = require('../lib/queue-runner');
const Queue = require('../lib/queue');
const producerLib = require('../lib/jobs/producer')

const heuristic = score => job => ({ ...job, entranceTime: Date.now(), score, ...{ calculated: { latestScore: {} } } })
const heuristicStub = score => job => ({ ...job })
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});

let queue = null;
let consumer;

describe('Queue Tests', () => {

    let _semaphore = null;
    before(() => {
        consumer = global.consumer;
    });
    beforeEach(async () => {
        queue = new Queue();
        _semaphore = new semaphore();
        queueRunner.queue.queue = [];
    });
    describe('queue-tests', () => {
        describe('add', () => {
            it('should added to queue', async () => {
                queue = new Queue();
                queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                queue.enqueue(stubTemplate());
                const q = queue.getQueue();
                expect(q[0].score).to.eql(80);
            });
            it('should added to queue ordered', async () => {
                queue = new Queue();
                queue.updateHeuristic({ run: heuristicStub() });
                queue.enqueue(stubTemplate({ score: 80 }));
                queue.enqueue(stubTemplate({ score: 60 }));
                queue.enqueue(stubTemplate({ score: 90 }));
                expect(queue.getQueue()[0].score).to.eql(90);
                expect(queue.getQueue()[1].score).to.eql(80);
                expect(queue.getQueue()[2].score).to.eql(60);
            });
        });
        describe('remove', () => {
            it('should removed from queue', async () => {
                queue.updateHeuristic({ run: heuristic(80) });
                const stubJob = stubTemplate();
                queue.enqueue(stubJob);
                queue.on(queueEvents.REMOVE, () => {
                    _semaphore.callDone();
                });
                queue.remove(stubJob.jobId);
                await _semaphore.done();
                const q = queue.getQueue();
                expect(q).to.have.length(0);
            });
            it('should not removed from queue when there is no matched id', async () => {
                let called = false;
                queue.updateHeuristic({ run: heuristic(80) });
                const stubJob = stubTemplate();
                queue.enqueue(stubJob);
                queue.on(queueEvents.REMOVE, () => {
                    called = true;
                });
                queue.remove('not_exist job');
                await delay(1000);
                expect(called).to.equal(false);
            }).timeout(3000);
        });
        describe('pop', () => {
            it('should pop from queue', async () => {
                queue.updateHeuristic({ run: heuristic(80) });
                const stubJob = stubTemplate();
                queue.enqueue(stubJob);
                queue.on(queueEvents.POP, () => {
                    _semaphore.callDone();
                });
                const job = queue.dequeue(stubJob.jobId);
                await _semaphore.done({ doneAmount: 1 });
                const q = queue.getQueue();
                expect(job.jobId).to.be.eql(stubJob.jobId);
                expect(q).to.have.length(0);
            });
            it('should pop correct job from queue', async () => {
                queue.updateHeuristic({ run: heuristic(80) });
                for (let i = 0; i < 10; i++) {
                    const stubJob = stubTemplate();
                    queue.enqueue(stubJob);
                }
                queue.on(queueEvents.POP, () => {
                    _semaphore.callDone();
                });
                const jobToPop = queue.getQueue()[3];
                const job = queue.dequeue(jobToPop.jobId);
                await _semaphore.done({ doneAmount: 1 });
                const q = queue.getQueue();
                expect(job.jobId).to.be.eql(jobToPop.jobId);
                expect(q).to.have.length(9);
                expect(q).to.not.include(jobToPop);
            });
        });
        describe('queue-events', () => {
            it('check events insert', async () => {
                queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                queue.updateHeuristic({ run: heuristic(80) });
                queue.enqueue(stubTemplate());
                await _semaphore.done();
            });
            it('check events remove', async () => {
                queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                queue.updateHeuristic({ run: heuristic(80) });
                const stubJob = stubTemplate();
                queue.enqueue(stubJob);
                await queue.remove(stubJob.jobId);
                await _semaphore.done();
            });
        });
    });
    describe('queue-runner', () => {
        it('check-that-heuristics-sets-to-latestScore', async () => {
            const stubJob = stubTemplate();
            producerLib._isConsumerActive = false;
            queueRunner.queue.enqueue(stubJob);
            const q = queueRunner.queue.getQueue();
            expect(q[0].score).to.be.above(0);
            expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
            expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
        });
    });
});