const { expect } = require('chai');
const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const { stubTemplate } = require('./stub/stub');
const baseUrl = `http://localhost:${config.rest.port}`;
const restUrl = `${baseUrl}/${config.rest.prefix}`;
const { request } = require('./utils');
let preferredService, queueRunner;
const dataStore = require('../lib/persistency/data-store');
const { pipelineStatuses } = require('@hkube/consts');
let producerLib;

describe('Preferred and Managed', () => {
    before(() => {
        queueRunner = require('../lib/queue-runner');
        preferredService = require('../lib/service/preferred-jobs');
        producerLib = require('../lib/jobs/producer');
    });
    beforeEach(() => {
        producerLib._isConsumerActive = false;
    });
    afterEach(async () => {

        producerLib._isConsumerActive = true;
    });
    describe('managed tests', () => {
        let jobs;
        beforeEach(async () => {
            jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a', entranceTime: 1, priority: 1 });
            jobs.push({ jobId: 'b', pipelineName: 'p_a', tags: ['a', 'b'], entranceTime: 2, priority: 2 });
            jobs.push({ jobId: 'c', pipelineName: 'p_a', entranceTime: 3, priority: 3, });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b', entranceTime: 4, priority: 4, });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b', entranceTime: 5, priority: 5, });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b', entranceTime: 6, priority: 6 });
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(stubTemplate(job))));
        });
        it('aggregation', async () => {
            let result = await request({
                url: `${restUrl}/managed/aggregation/pipeline`, method: 'GET'
            });
            expect(result.body.length).to.eql(2);
        });
        it('getting', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&firstJobId=c`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(2);
            expect(result.body.nextCount).to.eql(2);
            expect(result.body.prevCount).to.eql(2);
            expect(result.body.returnList[1].jobId).to.eql('b_a');
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&firstJobId=b_b`, method: 'GET'

            });
            expect(result.body.nextCount).to.eql(0);
            expect(result.body.prevCount).to.eql(4);
            expect(result.body.returnList[0].jobId).to.eql('b_b');
            expect(result.body.returnList.length).to.eql(2);
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&lastJobId=c`, method: 'GET'

            });
            expect(result.body.nextCount).to.eql(3);
            expect(result.body.prevCount).to.eql(1);
            expect(result.body.returnList[0].jobId).to.eql('b');
            expect(result.body.returnList.length).to.eql(2);
            result = await request({
                url: `${restUrl}/managed/?pageSize=10&pipelineName=p_a`, method: 'GET'

            });
            expect(result.body.nextCount).to.eql(0);
            expect(result.body.prevCount).to.eql(0);
            expect(result.body.returnList.length).to.eql(3);
            expect(result.body.returnList.map((job) => job.jobId)).to.include('a');
        });
        it('getting filters', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=6&pipelineName=p_b`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(3);
            expect(result.body.nextCount).to.eql(0);
            expect(result.body.prevCount).to.eql(0);
            expect(result.body.returnList[0].jobId).to.eql('b_a');

            result = await request({
                url: `${restUrl}/managed/?pageSize=6&tag=a`, method: 'GET'
            });

            expect(result.body.returnList.length).to.eql(1);
            expect(result.body.nextCount).to.eql(0);
            expect(result.body.prevCount).to.eql(0);
            expect(result.body.returnList[0].jobId).to.eql('b');
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&lastJobs=true`, method: 'GET'
            });

            expect(result.body.returnList.length).to.eql(2);
            expect(result.body.nextCount).to.eql(0);
            expect(result.body.prevCount).to.eql(4);
            expect(result.body.returnList[0].jobId).to.eql('b_b');
        });
        it('getting missing', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&firstJobId=noneExisting`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(2);
            expect(result.body.nextCount).to.eql(4);
            expect(result.body.prevCount).to.eql(0);
            expect(result.body.returnList[0].jobId).to.eql('a');
        });
    });
    describe('preferred tests', () => {
        it('preferred order', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a', entranceTime: 10 });
            jobs.push({ jobId: 'b', pipelineName: 'p_a', entranceTime: 10 });
            jobs.push({ jobId: 'c', pipelineName: 'p_a', entranceTime: 10 });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b', entranceTime: 10 });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b', entranceTime: 10 });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b', entranceTime: 10 });
            jobs.map(job => queueRunner.queue.enqueue(stubTemplate(job)));
            await preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'after', query: { pipelineName: 'p_a' } });
            await preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'before', query: { pipelineName: 'p_b' } });
            expect(queueRunner.preferredQueue.queue.every((val, index) => val.jobId === jobs[index].jobId)).to.eql(true);
        });
        it('preferred aggregation', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipeline: { name: 'p_a', tags: ['a'] }, entranceTime: 10 });
            jobs.push({ jobId: 'b', pipeline: { name: 'p_b', tags: ['a'] }, entranceTime: 10 });
            jobs.push({ jobId: 'c', pipeline: { name: 'p_a', tags: ['a'] }, entranceTime: 10 });
            jobs.push({ jobId: 'b_a', pipeline: { name: 'p_a', tags: ['b'] }, entranceTime: 10 });
            jobs.push({ jobId: 'b_b', pipeline: { name: 'p_b', tags: ['a', 'b'] }, entranceTime: 10 });
            jobs.push({ jobId: 'b_c', pipeline: { name: 'p_b', tags: ['a'] }, entranceTime: 10 });
            const status = {
                status: 'queued'
            };
            await Promise.all(jobs.map((job) => dataStore.createJob({ jobId: job.jobId, pipeline: job.pipeline, status })));
            const loadedJobs = await dataStore.getJobs({ status: pipelineStatuses.QUEUED });
            await queueRunner.queue.persistencyLoad(loadedJobs);
            await queueRunner.preferredQueue.persistencyLoad(loadedJobs, true)
            await preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            await preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'last' });
            await preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            let result = await request({
                url: `${restUrl}/preferred/aggregation/pipeline`, method: 'GET'
            });
            expect(result.body.length).eql(4);
            expect(result.body[2].name).eql('p_a');
            expect(result.body[2].count).eql(2);

            result = await request({
                url: `${restUrl}/preferred/aggregation/tag`, method: 'GET'
            });
            expect(result.body.length).eql(4);
            expect(result.body[2].name).eql(['a', 'b'].toString());
            expect(result.body[2].count).eql(1);
        });
        describe('preferred api', () => {
            it('preferred api', async () => {
                const jobs = [];
                jobs.push({ jobId: 'a', pipeline: { name: 'p_a' }, entranceTime: 10 });
                jobs.push({ jobId: 'b', pipeline: { name: 'p_a' }, tags: ['tag1'], entranceTime: 10 });
                jobs.push({ jobId: 'c', pipeline: { name: 'p_a' }, entranceTime: 10 });
                queueRunner.queue.queue = [];
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
                expect(result.body.error.message).to.eql('Query must contain only one of jobId ,tag ,pipelineName');
                result = await request({
                    url: `${restUrl}/preferred?pageSize=3`, method: 'GET'
                });
                expect(result.body.returnList[0].jobId === 'a' && result.body.returnList[1].jobId === 'b' && result.body.returnList[2].jobId === 'c').to.eql(true)
                result = await request({
                    url: `${restUrl}/preferred/deletes`, method: 'POST', body: {
                        "jobs": ['c']
                    }
                });
                expect(result.body[0].jobId).to.eql('c')

            });
        });
    });
});