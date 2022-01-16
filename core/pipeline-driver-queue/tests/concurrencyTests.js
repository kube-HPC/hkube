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
const persistence = require('../lib/persistency/persistence');
const setting = { prefix: 'pipeline-driver-queue' }
const producer = new Producer({ setting });
const Queue = require('../lib/queue');
const producerLib = require('../lib/jobs/producer')

const heuristicStub = score => job => ({ ...job })
describe('Concurrency', () => {
    beforeEach(async () => {
        queueRunner.queue.queue = [];
        await persistence.client.jobs.active._client.delete('/jobs/active', { isPrefix: true });
        producerLib._isConsumerActive=true;
        queueRunner.queue.updateHeuristic({ run: heuristicStub() });
    });
    afterEach(async () => {
        queueRunner.queue.updateHeuristic(queueRunner.heuristicRunner);
    });
    describe('concurrency', () => {
        it('should found and disable concurrent exceeded jobs', async () => {
            const jobs = 10;
            const pipelineName = 'pipeline-concurrent';
            const experimentName = 'experiment-concurrent'
            const pipeline = pipelines.find(p => p.name === pipelineName);
            await persistence.client.pipelines.set(pipeline);
            await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'active', types: ['stored'] });
            for (let i = 0; i < 150; i++) {
                await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'pending', types: ['stored'] });
            }

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
            let result = await producerLib._concurrencyHandler._checkConcurrencyJobs();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(1)
            const expectedNewJobs = pipeline.options.concurrentPipelines.amount - 1;
            expect(result).to.eql(expectedNewJobs);
            queueRunner.queue.queue.slice(0, expectedNewJobs).forEach(job => {
                expect(job.maxExceeded).to.be.false;
                expect(job.updateRunning).to.eql(1);
            });
            queueRunner.queue.queue.slice(expectedNewJobs).forEach(job => {
                expect(job.maxExceeded).to.be.true;
                expect(job.updateRunning).to.not.exist;
            });
            await producerLib._dequeueJobInternal();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(2)
            await producerLib._dequeueJobInternal();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(3)
            await producerLib._dequeueJobInternal();
            await producerLib._dequeueJobInternal();
            await producerLib._dequeueJobInternal();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(5)
            // checking jobs will get updated values from etcd
            result = await producerLib._concurrencyHandler._checkConcurrencyJobs();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(1)
        });

        it('should not dequeue job if active is higher than concurrency', async () => {
            const jobs = 10;
            const pipelineName = 'pipeline-concurrent';
            const experimentName = 'experiment-concurrent'
            const pipeline = pipelines.find(p => p.name === pipelineName);
            await persistence.client.pipelines.set(pipeline);
            for (let i = 0; i < 5; i++) {
                await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'active', types: ['stored'] });
            }
            for (let i = 0; i < 150; i++) {
                await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'pending', types: ['stored'] });
            }

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
            let result = await producerLib._concurrencyHandler._checkConcurrencyJobs();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(5)
            expect(result).to.eql(0);
            expect(queueRunner.queue.size).to.eql(jobs-1);
            await producerLib._concurrencyHandler._checkMaxExceeded({ experiment: experimentName, pipeline: pipelineName });
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(4)
            await persistence.client.jobs.active._client.delete('/jobs/active', { isPrefix: true });
            for (let i = 0; i < 3; i++) {
                await persistence.client.jobs.active.set({ jobId: uuidv4(), pipeline: pipelineName, experiment: experimentName, status: 'active', types: ['stored'] });
            }
            result = await producerLib._concurrencyHandler._checkConcurrencyJobs();
            expect(result).to.eql(2);
            await producerLib._dequeueJobInternal();
            await producerLib._dequeueJobInternal();
            await producerLib._dequeueJobInternal();
            expect(producerLib._concurrencyHandler._activeState[pipelineName].count).to.eql(5)

        });
    });
});