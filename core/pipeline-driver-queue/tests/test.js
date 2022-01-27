const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('await-delay');
const { stubTemplate } = require('./stub/stub');
const { uid: uuidv4 } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const pipelines = require('./stub/pipelines.json');
const dataStore = require('../lib/persistency/data-store');
const setting = { prefix: 'pipeline-driver-queue' }
const { pipelineStatuses } = require('@hkube/consts');
const producer = new Producer({ setting });
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
let queueRunner;
let producerLib;
let Queue;

describe('Main Queue Test', () => {
    before(async () => {
        consumer = require('../lib/jobs/consumer');
        queueRunner = require('../lib/queue-runner');
        producerLib = require('../lib/jobs/producer');
        Queue = require('../lib/queue');
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
            const jobId = uuidv4();
            const pipeline = {
                name: 'test',
                experimentName: 'test',
            };
            const status = {
                status: 'queued'
            };
            const count = 50;
            const keys = Array.from(Array(count).keys());
            await Promise.all(keys.map(() => dataStore.createJob({ jobId, pipeline, status })));
            let loadedJobs = await dataStore.getJobs({ status: pipelineStatuses.QUEUED });
            await queueRunner.queue.persistencyLoad(loadedJobs);
            const queue = queueRunner.queue.getQueue();
            expect(queue.length).to.be.gte(count);
        });
    });
    describe('job-consume', () => {
        it('should consume job with params', async () => {
            const jobId = uuidv4();
            await dataStore._db.jobs.create({ jobId, pipelineName: pipelines[0] });
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
});