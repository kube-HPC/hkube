const { expect } = require('chai');
const { generateArr } = require('./stub/stub');
const { semaphore } = require('await-done');
const bootstrap = require('../bootstrap');
const queueRunner = require('../lib/queue-runner');
const producerLib = require('../lib/jobs/producer');
const Queue = require('../lib/queue');
const preferredService = require('../lib/service/preferred-jobs');
const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const baseUrl = `http://localhost:${config.rest.port}`;
const restUrl = `${baseUrl}/${config.rest.prefix}`;
const { request } = require('./utils');
const heuristic = score => job => ({ ...job, entranceTime: Date.now(), score, ...{ calculated: { latestScore: {} } } })

let queue = null;

describe('Test', () => {
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
            queueRunner.preferredQueue.queue = [];
            queueRunner.queue.queue = [];
            const jobs = generateArr(100);
            queueRunner.queue.queue = jobs;
            await queueRunner.queue.persistenceStore();
            await queueRunner.queue.persistencyLoad();
            const q = queueRunner.queue.getQueue();
            expect(q.length).to.be.greaterThan(98);
            queueRunner.preferredQueue.queue = jobs;
            await queueRunner.preferredQueue.persistenceStore();
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
    describe('preferred api', () => {
        it('preferred api', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipeline: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b', pipeline: 'p_a', tags: ['tag1'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'c', pipeline: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            queueRunner.queue.queue = [];
            queueRunner.preferredQueue.queue = [];
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(job)));
            let result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["b"],
                    "position": "first"
                }
            });
            expect(result.body[0].jobId === 'b');
            result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["b"],
                    "position": "first"
                }
            });
            expect(result.body.error.message === 'None of the jobs exist in the general queue');
            result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["a"],
                    "position": "before",
                    "query": { jobId: 'b' }
                }
            });
            result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["c"],
                    "position": "after",
                    "query": { tag: 'tag1' }
                }
            });
            result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["c"],
                    "position": "after",
                    "query": { tag: 'tag1', jobId: 'd' }
                }
            });
            expect(result.body.error.message === 'Query must contain only one of jobId ,tag ,pipelineName');
            result = await request({
                url: `${restUrl}/preferred`, method: 'GET'
            });
            expect(result.body[0].jobId === 'a' && result.body[1].jobId === 'b' && result.body[2].jobId === 'c')
            result = await request({
                url: `${restUrl}/preferred/deletes`, method: 'POST', body: {
                    "jobs": ['c']
                }
            });
            expect(result.body[0].jobId === 'c')

        });
    });
});