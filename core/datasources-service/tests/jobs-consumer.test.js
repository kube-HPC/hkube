const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const waitFor = require('./waitFor');
const pathLib = require('path');
const { getDatasourcesInUseFolder } = require('../lib/utils/pathUtils');
const { mockRemove, nonExistingId } = require('./utils');
const {
    createDataSource,
    createSnapshot,
    createJob,
} = require('./api');
let jobConsumer;
let storageManager;
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
        storageManager = require('@hkube/storage-manager');
        rootDir = getDatasourcesInUseFolder(global.testParams.config);
    });
    after(() => {
        fse.remove(rootDir);
    });
    it('should throw error if dataSource not exist', async () => {
        const dataSource = { id: nonExistingId };
        const job = await createJob({ dataSource });
        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'failed');
        expect(state.status).to.equal('failed');
        expect(state.error).to.equal(
            `could not find dataSource:${nonExistingId.toString()}`
        );
    });
    it('should succeed mounting the datasource - github and update job', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource(name);
        const job = await createJob({ dataSource });
        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'succeed');
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
        const storagePayload = await storageManager.hkubeDataSource.get(
            state.result.storageInfo
        );
        expect(storagePayload.dataSourceId).to.eq(dataSource.id);
        const mountedPath = pathLib.join(

            global.testParams.mountedDir,
            jobId,
            dataSource.name
        );
        expect(await fse.pathExists(mountedPath)).to.be.true;
    });
    it.skip('should succeed mounting the datasource - gitlab and update job', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource(name, {
            useGitlab: true,
        });
        const job = await createJob({ dataSource });
        const { jobId, taskId } = job.data;
        const state = await waitForStatus({ jobId, taskId }, 'succeed');
        expect(state.status).to.equal('succeed');
        expect(state).to.have.property('result');
        const mountedPath = pathLib.join(

            global.testParams.mountedDir,
            dataSource.name,
            dataSource.id,
            dataSource.name
        );
        expect(await fse.pathExists(mountedPath)).to.be.true;
    });

    it('should succeed pulling a datasource by snapshot and filter the files by query', async () => {
        const name = uuid();
        const mockedRemove = mockRemove();
        const snapshotName = uuid();
        const { body: dataSource } = await createDataSource(name, {
            fileNames: ['README-1.md', 'logo.svg', 'logo.svg.meta'],
        });
        const { body: snapshot } = await createSnapshot({
            name: dataSource.name,
            snapshot: { name: snapshotName, query: 'about the logo' },
        });

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
        const storagePayload = await storageManager.hkubeDataSource.get(
            state.result.storageInfo
        );
        expect(storagePayload.snapshotId).to.eq(snapshot.id);

        const mountedDir = `${rootDir}/${jobId}/${dataSource.name}/${snapshotName}`
        //${dataSource.name}`;
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
        ].map(p => mockedRemove.calledWith(p));

        expect(existingFiles.every(item => item)).to.be.true;
        expect(nonExistingFiles.every(item => item)).to.be.true;
    });
});
