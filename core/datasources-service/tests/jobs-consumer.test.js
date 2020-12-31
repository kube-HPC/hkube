const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
let jobConsumer;
const { createDataSource, createJob, delay } = require('./utils');

describe.only('JobsConsumer', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
    });
    it('should throw error if dataSource not exist', async () => {
        const dataSource = {
            name: 'ds-1'
        };
        const job = await createJob({ dataSource });
        await delay(1000);
        const { jobId, taskId } = job.data;
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('failed');
        expect(state.error).to.equal(`could not find dataSource:${dataSource.name}`);
    });
    it('should throw error if dataSource not exist', async () => {
        const dataSource = {
            name: 'ds-2'
        };
        const job = await createJob({ dataSource });
        await delay(1000);
        const { jobId, taskId } = job.data;
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('failed');
        expect(state.error).to.equal(`could not find dataSource:${dataSource.name}`);
    });
    it('should succeed get datasource and update job', async () => {
        const name = uuid();
        await createDataSource({ body: { name } });
        const dataSource = { name };
        const job = await createJob({ dataSource });
        await delay(10000);
        const { jobId, taskId } = job.data;
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
    });
});
