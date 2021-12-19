const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('await-delay');
const { generateArr, stubTemplate } = require('./stub/stub');
const { uid: uuidv4 } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const { pipelines } = require('./mock/index');
const bootstrap = require('../bootstrap');
const queueRunner = require('../lib/queue-runner');
const dataStore = require('../lib/persistency/data-store');
const producerLib = require('../lib/jobs/producer');
const setting = { prefix: 'pipeline-driver-queue' }
const preferredService = require('../lib/service/preferred-jobs');
const producer = new Producer({ setting });
const Queue = require('../lib/queue');
const heuristic = score => job => ({ ...job, entranceTime: Date.now(), score, ...{ calculated: { latestScore: {} } } })
const heuristicStub = score => job => ({ ...job })
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});

let queue = null;
let consumer;
let _semaphore = null;

describe('Test', () => {
    before(async () => {
        require('../lib/jobs/producer')._updateState = function () { };
        await bootstrap.init();
        consumer = require('../lib/jobs/consumer');
    });
    beforeEach(() => {
        queue = new Queue();
        queue.updateHeuristic({ run: heuristic(80) });
        producerLib._isConsumerActive = false;
        _semaphore = new semaphore();
    });
    afterEach(() => {
        producerLib._isConsumerActive = true;
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
                queue.dequeue(stubJob);
                expect(queue.size).to.eql(0);
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
    describe('concurrent', () => {
        it('check concurrency limit', async () => {
            const totalJobs = 10;
            const half = totalJobs / 2;
            const keys = Array.from(Array(totalJobs).keys());
            const jobsList = [];
            producerLib._isConsumerActive = true;
            let spy = sinon.spy(producerLib, 'createJob');

            // creating 10 jobs which half are maxExceeded
            await Promise.all(keys.map(async (i) => {
                const jobId = uuidv4();
                const job = {
                    data: { jobId },
                    done: () => { }
                };
                const maxExceeded = i % 2 === 0;
                const pipeline = {
                    jobId,
                    experimentName: 'test',
                    name: 'test',
                    maxExceeded
                };
                const status = {
                    status: 'pending'
                };
                jobsList.push({ jobId, maxExceeded, experiment: 'test', pipeline: 'test' });
                await dataStore._db.jobs.create({ jobId, pipeline, status });
                await consumer._handleJob(job);
            }));

            const nonExceededCount = spy.callCount;
            sinon.restore();
            spy = sinon.spy(producerLib, 'createJob');
            const jobs = jobsList.slice(0, half);

            // simulate that half of jobs are completed
            let index = 0;
            while (jobs.length) {
                const job = jobs.pop();
                producerLib._isConsumerActive = true;
                producerLib._producer.emit('job-completed', { options: { data: job } });
                expect(spy.callCount).to.eql(++index);
                await delay(100);
            }
            const exceededCount = spy.callCount;
            expect(nonExceededCount).to.eql(half);
            expect(exceededCount).to.eql(half);
        });
    });
    describe('queue-runner', () => {
        it('check-that-heuristics-sets-to-latestScore', async () => {
            const stubJob = stubTemplate();
            queueRunner.queue.enqueue(stubJob);
            const q = queueRunner.queue.getQueue();
            expect(q[0].score).to.be.above(0);
            expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
            expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
        });
    });
    describe('persistency tests', () => {
        it('persistent load', async () => {
            queueRunner.preferredQueue.queue = [];
            queueRunner.queue.queue = [];
            const jobs = generateArr(100);
            await queueRunner.queue.persistenceStore(jobs);
            await queueRunner.queue.persistencyLoad();
            const q = queueRunner.queue.getQueue();
            expect(q.length).to.be.greaterThan(98);
            await queueRunner.preferredQueue.persistenceStore(jobs);
            await queueRunner.preferredQueue.persistencyLoad(true);
            const pq = queueRunner.preferredQueue.getQueue();
            expect(jobs[0].jobId == pq[0].jobId && jobs[99].jobId == pq[99].jobId)
        });
    });
    describe('preferred tests', () => {
        it('preferred order', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipeline: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b', pipeline: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'c', pipeline: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_a', pipeline: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_b', pipeline: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_c', pipeline: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(job)));
            preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'after', query: { pipeline: 'p_a' } });
            preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'before', query: { pipeline: 'p_b' } });
            expect(queueRunner.preferredQueue.queue.every((val, index) => val.jobId === jobs[index].jobId));
        });
    });
    describe('job-consume', () => {
        it('should consume job with params', async () => {
            const jobId = uuidv4();
            await dataStore._db.jobs.create({ jobId, pipeline: pipelines[0] });
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