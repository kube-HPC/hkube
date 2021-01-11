const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const sinon = require('sinon');

let jobConsumer;
const {
    createDataSource,
    createSnapshot,
    createJob,
    delay,
} = require('./utils');
let rootDir = null;

describe.only('JobsConsumer', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
        rootDir = global.testParams.directories.dataSourcesInUse;
    });
    after(() => {
        fse.remove(rootDir);
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
    it('should succeed pulling a datasource by snapshot and filter the files by query', async () => {
        sinon.restore();
        const name = uuid();
        const snapshotName = uuid();
        const { body: dataSource } = await createDataSource({
            body: { name },
            fileNames: ['README-1.md', 'logo.svg', 'logo.svg.meta'],
        });
        await createSnapshot({
            name: dataSource.name,
            snapshot: { name: snapshotName, query: 'about the logo' },
        });
        const job = await createJob({
            dataSource: { name: dataSource.name, snapshotName },
        });
        await delay(10000);

        const { jobId, taskId } = job.data;
        const state = await jobConsumer.state.get({ jobId, taskId });
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
        const mountedDir = `${rootDir}/${dataSource.name}/${dataSource.id}/${dataSource.name}`;
        const existingFiles = await Promise.all(
            [
                `${mountedDir}`,
                `${mountedDir}/data/logo.svg`,
                `${mountedDir}/data/logo.svg.dvc`,
                `${mountedDir}/data/logo.svg.meta`,
            ].map(p => fse.pathExists(p))
        );
        const nonExistingFiles = await Promise.all(
            [
                `${mountedDir}/data/README-1.md`,
                `${mountedDir}/data/README-1.md.dvc`,
            ].map(p => fse.pathExists(p))
        );
        expect(existingFiles.every(item => item)).to.be.true;
        expect(nonExistingFiles.every(item => !item)).to.be.true;
    });
    // fetch the same snapshot again to load it from the cache
});
