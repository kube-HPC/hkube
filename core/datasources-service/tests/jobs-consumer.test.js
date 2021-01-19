const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const waitFor = require('./waitFor');
const sinon = require('sinon');

/** @type {import('../lib/service/jobs-consumer')} */
let jobConsumer;

const { createDataSource, createSnapshot, createJob } = require('./utils');
let rootDir = null;

const waitForStatus = async ({ jobId, taskId }, status) => {
    let state = null;
    await waitFor(async () => {
        state = await jobConsumer.state.get({ jobId, taskId });
        return state.status === status;
    });
    return state;
};

describe('JobsConsumer', () => {
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
        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'failed');
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
        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'succeed');
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
    });
    it('should succeed pulling a datasource by snapshot and filter the files by query', async () => {
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

        sinon.reset();
        const job = await createJob({
            dataSource: {
                name: dataSource.name,
                snapshot: { name: snapshotName },
            },
        });

        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'succeed');

        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');

        const mountedDir = `${rootDir}/${dataSource.name}/${dataSource.id}/${dataSource.name}`;
        const existingFiles = await Promise.all(
            [
                `${mountedDir}`,
                `${mountedDir}/data/logo.svg`,
                `${mountedDir}/data/logo.svg.dvc`,
            ].map(p => fse.pathExists(p))
        );

        const nonExistingFiles = [
            `${mountedDir}/data/README-1.md`,
            `${mountedDir}/data/README-1.md.dvc`,
            `${mountedDir}/data/logo.svg.meta`,
        ].map(p => fse.remove.calledWith(p));

        expect(existingFiles.every(item => item)).to.be.true;
        expect(nonExistingFiles.every(item => item)).to.be.true;
    });
});
