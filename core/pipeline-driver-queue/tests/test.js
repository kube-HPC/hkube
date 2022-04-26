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
const dataStore = require('../lib/persistency/data-store');
const producerLib = require('../lib/jobs/producer');
const setting = { prefix: 'pipeline-driver-queue' }
const producer = new Producer({ setting });
const Queue = require('../lib/queue');
const { pipelineStatuses } = require('@hkube/consts');
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
        consumer = global.consumer;
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

    describe('persistency tests', () => {
        it('persistent load', async () => {
            queueRunner.queue.queue = [];
            const jobs = generateArr(100);
            await Promise.all(jobs.map(j=>dataStore._db.jobs.create({ jobId: j.jobId, status: {status: pipelineStatuses.PENDING}, pipeline: pipelines[0] })));
            queueRunner.queue.queue = jobs;
            await queueRunner.queue.persistenceStore();
            queueRunner.queue.queue = [];
            await queueRunner.queue.persistencyLoad();
            const q = queueRunner.queue.getQueue();
            expect(q.length).to.be.greaterThan(98);
            queueRunner.preferredQueue.queue = jobs;
            await queueRunner.preferredQueue.persistenceStore();
            queueRunner.preferredQueue.queue = [];
            await queueRunner.preferredQueue.persistencyLoad(true);
            const pq = queueRunner.preferredQueue.getQueue();
            expect(jobs[0].jobId == pq[0].jobId && jobs[99].jobId == pq[99].jobId)
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