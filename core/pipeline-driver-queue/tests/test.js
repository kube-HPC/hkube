const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('await-delay');
const { generateArr, stubTemplate } = require('./stub/stub');
const { uid: uuidv4 } = require('@hkube/uid');
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
const producerLib = require('../lib/jobs/producer')

const heuristic = score => job => ({ ...job, entranceTime: Date.now(), score, ...{ calculated: { latestScore: {} } } })
const heuristicStub = score => job => ({ ...job })
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});

let queue = null;

describe('Test', () => {
    before(async () => {
        await bootstrap.init();
        await persistence.client._client.client.delete().all();
        consumer = require('../lib/jobs/consumer');
    });
    let _semaphore = null;
    beforeEach(() => {
        queue = new Queue();
        _semaphore = new semaphore();
    });
    describe('algorithm queue', () => {
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
    describe('persistency tests', () => {
        it.skip('persistent load', async () => {
            queueRunner.queue.queue = []
            const jobs = generateArr(100);
            await queueRunner.queue.persistenceStore(jobs);
            await queueRunner.queue.persistencyLoad();
            const q = queueRunner.queue.getQueue();
            expect(q.length).to.be.greaterThan(98);
        });
    });
    describe('job-consume', () => {
        it('should consume job with params', async () => {
            const jobId = uuidv4();
            await persistence.client.executions.stored.set({ jobId, ...pipelines[0] });
            await persistence.setJobStatus({ jobId, status: 'pending' });
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
    describe('Consumer', () => {
        it('should fail when consumer fail',async () => {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                failedReason: 'job stalled more than allowable limit',
            }
            await persistence.setJobStatus({ jobId });
            await persistence.client.executions.stored.set({ jobId, name: 'test-pipeline' });
            const spy = sinon.spy(persistence, "setJobStatus");
            await consumer._handleFailedJob(job)
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.eql({ jobId, status: 'failed', error: job.failedReason, pipeline: 'test-pipeline' });

            const result = await persistence.client.jobs.results.get({ jobId });
            expect(result.status).to.equal('failed');
            expect(result.error).to.equal(job.failedReason);

            const statusResult = await persistence.getJobStatus({ jobId });
            expect(statusResult.status).to.equal('failed');
            expect(statusResult.error).to.equal(job.failedReason);
        });
    });
    describe('concurrency', () => {
        it('should found and disable concurrent exceeded jobs', async () => {
            const jobs = 10;
            const pipelineName = 'pipeline-concurrent';
            const experimentName = 'experiment-concurrent'
            const pipeline = pipelines.find(p => p.name === pipelineName);
            await persistence.client.pipelines.set(pipeline);
            await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'active', types: ['stored'] });
            for (let i=0;i<150;i++) {
                await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'pending', types: ['stored'] });
            }
            queueRunner.queue.updateHeuristic({ run: heuristicStub() });

            for (let i = 0; i < jobs; i++) {
                const job = {
                    jobId: uuidv4(),
                    maxExceeded: i > 0,
                    done: () => { },
                    pipelineName,
                    experimentName,
                    priority: 3,
                    entranceTime: Date.now(),
                    calculated: {
                        latestScores: {}
                    }
                };
                queueRunner.queue.enqueue(job);
            }
            const result = await producerLib._checkConcurrencyJobs();
            expect(result).to.eql(pipeline.options.concurrentPipelines.amount - 1);
        });
    });
    afterEach(() => {
        queueRunner.queue.queue = [];
    });
});