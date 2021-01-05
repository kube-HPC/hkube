const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
let jobConsumer;
const {
    createDataSource,
    createSnapshot,
    createJob,
    delay,
} = require('./utils');

describe.only('JobsConsumer', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
    });
    it('should throw error if dataSource not exist', async () => {
        const dataSource = { name: 'ds-1' };
        const job = await createJob({ dataSource });
        await delay(1000);
        const { jobId, taskId } = job.data;
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('failed');
        expect(state.error).to.equal(
            `could not find dataSource:${dataSource.name}`
        );
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
    it.only('should succeed get datasource by snapshot', async () => {
        const name = uuid();
        const snapshotName = uuid();
        const { body: dataSource } = await createDataSource({ body: { name } });
        await createSnapshot({
            name: dataSource.name,
            id: dataSource.id,
            snapshot: { name: snapshotName, query: '' },
        });
        const job = await createJob({
            dataSource: {
                name: dataSource.name,
                snapshotName,
            },
        });
        await delay(10000);
        const { jobId, taskId } = job.data;
        console.log({ jobId });
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
    });
    // fetch the same snapshot again to load it from the cache
});
