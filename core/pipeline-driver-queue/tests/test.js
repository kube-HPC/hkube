const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('await-delay');
const { generateArr, stubTemplate } = require('./stub/stub');
const { uid: uuidv4 } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const queueEvents = require('../lib/consts/queue-events');
const { semaphore } = require('await-done');
const { pipelines } = require('./mock/index');
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
let consumer;

describe('Test', () => {
    
    let _semaphore = null;
    before(() => {
        consumer = global.consumer;
    });
    beforeEach(async () => {
        queue = new Queue();
        _semaphore = new semaphore();
        queueRunner.queue.queue = [];
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
        it('should fail when consumer fail', async () => {
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
});