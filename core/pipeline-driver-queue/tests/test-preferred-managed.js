const { expect } = require('chai');
const queueRunner = require('../lib/queue-runner');
const preferredService = require('../lib/service/preferred-jobs');
const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const baseUrl = `http://localhost:${config.rest.port}`;
const restUrl = `${baseUrl}/${config.rest.prefix}`;
const { request } = require('./utils');

describe('Preferred and Managed', () => {
    describe('managed tests', () => {
        let jobs;
        beforeEach(async () => {
            jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a', entranceTime: 1, priority: 1, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b', tags: ['a', 'b'], pipelineName: 'p_a', entranceTime: 2, priority: 2, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'c', pipelineName: 'p_a', entranceTime: 3, priority: 3, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b', entranceTime: 4, priority: 4, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b', entranceTime: 5, priority: 5, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b', entranceTime: 6, priority: 6, calculated: { latestScores: [] } });
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(job)));
        });
        it('aggregation', async () => {
            let result = await request({
                url: `${restUrl}/managed/aggregation/pipeline`, method: 'GET'
            });
            expect(result.body.length).to.eql(2);
        });
        it('getting', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&fromJob=c`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(2);
            expect(result.body.hasNext).to.eql(true);
            expect(result.body.hasPrev).to.eql(true);
            expect(result.body.returnList[0].jobId).to.eql('b_a');
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&fromJob=b_b`, method: 'GET'

            });
            expect(result.body.hasNext).to.eql(false);
            expect(result.body.hasPrev).to.eql(true);
            expect(result.body.returnList[0].jobId).to.eql('b_b');
            expect(result.body.returnList.length).to.eql(2);
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&toJob=c`, method: 'GET'

            });
            expect(result.body.hasNext).to.eql(true);
            expect(result.body.hasPrev).to.eql(false);
            expect(result.body.returnList[0].jobId).to.eql('a');
            expect(result.body.returnList.length).to.eql(2);
        });
        it('getting filters', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=6&pipelineName=p_b`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(3);
            expect(result.body.hasNext).to.eql(false);
            expect(result.body.hasPrev).to.eql(false);
            expect(result.body.returnList[0].jobId).to.eql('b_a');

            result = await request({
                url: `${restUrl}/managed/?pageSize=6&tag=a`, method: 'GET'
            });

            expect(result.body.returnList.length).to.eql(1);
            expect(result.body.hasNext).to.eql(false);
            expect(result.body.hasPrev).to.eql(false);
            expect(result.body.returnList[0].jobId).to.eql('b');
        });
        it('getting missing', async () => {
            result = await request({
                url: `${restUrl}/managed/?pageSize=2&fromJob=noneExisting`, method: 'GET'
            });
            expect(result.body.returnList.length).to.eql(2);
            expect(result.body.hasNext).to.eql(false);
            expect(result.body.hasPrev).to.eql(true);
            expect(result.body.returnList[0].jobId).to.eql('b_b');
        });
    });


    describe('preferred tests', () => {
        it('preferred order', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b', pipelineName: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'c', pipelineName: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b', entranceTime: 10, calculated: { latestScores: [] } });
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(job)));
            preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'after', query: { pipelineName: 'p_a' } });
            preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'before', query: { pipelineName: 'p_b' } });
            expect(queueRunner.preferredQueue.queue.every((val, index) => val.jobId === jobs[index].jobId));
        });


        it('preferred aggregation', async () => {
            const jobs = [];
            jobs.push({ jobId: 'a', pipelineName: 'p_a', tags: ['a'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b', pipelineName: 'p_b', tags: ['a'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'c', pipelineName: 'p_a', tags: ['a'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_a', pipelineName: 'p_a', tags: ['b'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_b', pipelineName: 'p_b', tags: ['a', 'b'], entranceTime: 10, calculated: { latestScores: [] } });
            jobs.push({ jobId: 'b_c', pipelineName: 'p_b', tags: ['a'], entranceTime: 10, calculated: { latestScores: [] } });
            await Promise.all(jobs.map(job => queueRunner.queue.enqueue(job)));
            preferredService.addPreferredJobs({ 'jobs': ['b'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['a'], position: 'first' });
            preferredService.addPreferredJobs({ 'jobs': ['c'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_a'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_b'], position: 'last' });
            preferredService.addPreferredJobs({ 'jobs': ['b_c'], position: 'last' });
            let result = await request({
                url: `${restUrl}/preferred/aggregation/pipeline`, method: 'GET'
            });
            expect(result.body.length).eql(4);
            expect(result.body[2].pipelineName).eql('p_a');
            expect(result.body[2].jobs.length).eql(2);

            result = await request({
                url: `${restUrl}/preferred/aggregation/tag`, method: 'GET'
            });
            expect(result.body.length).eql(4);
            expect(result.body[2].tags.toString()).eql(['a', 'b'].toString());
            expect(result.body[2].jobs.length).eql(1);
        });

        describe('preferred api', () => {

            it('preferred api', async () => {
                const jobs = [];
                jobs.push({ jobId: 'a', pipelineName: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
                jobs.push({ jobId: 'b', pipelineName: 'p_a', tags: ['tag1'], entranceTime: 10, calculated: { latestScores: [] } });
                jobs.push({ jobId: 'c', pipelineName: 'p_a', entranceTime: 10, calculated: { latestScores: [] } });
                queueRunner.queue.queue = [];
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
                expect(result.body.error.message === 'Query must contain only one of jobId ,tag ,pipeline');
                result = await request({
                    url: `${restUrl}/preferred`, method: 'GET'
                });
                expect(result.body.returnList[0].jobId === 'a' && result.body.returnList[1].jobId === 'b' && result.body.returnList[2].jobId === 'c')
                result = await request({
                    url: `${restUrl}/preferred/deletes`, method: 'POST', body: {
                        "jobs": ['c']
                    }
                });
                expect(result.body[0].jobId === 'c')

            });
        });
    });
    afterEach(() => {
        queueRunner.queue.queue = [];
        queueRunner.preferredQueue.queue = [];
    });
    beforeEach(() => {
        queueRunner.queue.queue = [];
        queueRunner.preferredQueue.queue = [];
    });
});