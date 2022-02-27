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

describe('Concurrency', () => {
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

    describe('concurrent', () => {
        it('check concurrency limit', async () => {
            queueRunner.queue.queue = [];
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
                await delay(1);
            }
            await delay(500);
            const exceededCount = spy.callCount;
            expect(nonExceededCount).to.eql(half);
            expect(exceededCount).to.eql(half);
        });
    });

});