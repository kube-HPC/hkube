const { expect } = require('chai');
const { generateArr, stubTemplate } = require('./stub/stub');
const { semaphore } = require('await-done');
const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const baseUrl = `http://localhost:${config.rest.port}`;
const restUrl = `${baseUrl}/${config.rest.prefix}`;
const { request } = require('./utils');
const dataStore = require('../lib/persistency/data-store');
const { pipelineStatuses } = require('@hkube/consts');

const heuristic = score => job => ({ ...job, entranceTime: Date.now(), score, ...{ calculated: { latestScore: {} } } })

let queue;
let preferredService;
let queueRunner;
let producerLib;
let Queue;

describe('Preferred Queue Tests', () => {
    before(async () => {
        preferredService = require('../lib/service/preferred-jobs');
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
    describe('preferred persistency tests', () => {
        it('persistent load', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a' });
            jobs.push({ jobId: 'b', pipelineName: 'p_a' });
            jobs.push({ jobId: 'c', pipelineName: 'p_a' });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b' });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b' });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b' });
            const pipeline = {
                name: 'test',
                experimentName: 'test',
            };
            const status = {
                status: 'queued'
            };
            await Promise.all(jobs.map((job) => dataStore.createJob({ jobId: job.jobId, pipeline, status })));
            let loadedJobs = await dataStore.getJobs({ status: pipelineStatuses.QUEUED });
            await queueRunner.queue.persistencyLoad(loadedJobs);
            await preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            queueRunner.queue.queue = [];
            queueRunner.preferredQueue.queue = [];
            loadedJobs = await dataStore.getJobs({ status: pipelineStatuses.QUEUED });
            await queueRunner.queue.persistencyLoad(loadedJobs);
            await queueRunner.preferredQueue.persistencyLoad(loadedJobs, true)
            let queue = queueRunner.queue.getQueue();
            expect(queue.length).to.be.gte(3);
            queue = queueRunner.preferredQueue.getQueue();
            expect(queue.length).to.be.gte(3);
            expect(queueRunner.preferredQueue.queue[0].jobId).to.eql('a');
            expect(queueRunner.preferredQueue.queue[1].jobId).to.eql('b');
            expect(queueRunner.preferredQueue.queue[2].jobId).to.eql('c');
        });
    });

    describe('preferred tests', () => {
        it('preferred order', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a' });
            jobs.push({ jobId: 'b', pipelineName: 'p_a' });
            jobs.push({ jobId: 'c', pipelineName: 'p_a' });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b' });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b' });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b' });
            jobs.map(job => queueRunner.queue.enqueue(stubTemplate(job)));
            await preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'after', query: { pipelineName: 'p_a' } });
            await preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'before', query: { pipelineName: 'p_b' } });
            expect(queueRunner.preferredQueue.queue.every((val, index) => val.jobId === jobs[index].jobId)).to.eql(true);
        });
    });
    describe('preferred api', () => {
        it('preferred api', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipeline: 'p_a' });
            jobs.push({ jobId: 'b', pipelineName: 'p_a', tags: ['tag1'] });
            jobs.push({ jobId: 'c', pipelineName: 'p_a' });
            queueRunner.queue.queue = [];
            queueRunner.preferredQueue.queue = [];
            jobs.map(job => queueRunner.queue.enqueue(stubTemplate(job)));
            let result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["b"],
                    "position": "first"
                }
            });
            expect(result.body[0].jobId === 'b').to.eql(true);
            result = await request({
                url: `${restUrl}/preferred`, method: 'POST', body: {
                    "jobs": ["b"],
                    "position": "first"
                }
            });
            expect(result.body.error.message).to.eql('None of the jobs exist in the general queue');
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
            expect(result.body.error.message === ' ,pipelineName');
            result = await request({
                url: `${restUrl}/preferred`, method: 'GET'
            });
            expect(result.body.returnList[0].jobId === 'a' && result.body.returnList[1].jobId === 'b' && result.body.returnList[2].jobId === 'c')
            result = await request({
                url: `${restUrl}/preferred/deletes`, method: 'POST', body: {
                    "jobs": ['c']
                }
            });
            expect(result.body[0].jobId).to.eql('c')
        });
    });
});