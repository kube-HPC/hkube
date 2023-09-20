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

describe('Save Mid Pipeline', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
        storageManager = require('@hkube/storage-manager');
        rootDir = getDatasourcesInUseFolder(global.testParams.config);
        restUrl = global.testParams.restUrl;
    
    });
    after(() => {
        fse.remove(rootDir);
    });

    it.skip('should add new file to the dvc track', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource(name);
        const job = await createJob({ dataSource });
        const { jobId, nodeName } = job.data;
        const dsPath = pathLib.join(rootDir, jobId, name, 'complete');
        const newFilePath = pathLib.join(dsPath, 'data', 'a.txt');
        await fse.outputFile(newFilePath, 'testing');
        const options = {
            uri: `${restUrl}/${jobId}/${name}/${nodeName}`,
            method: 'POST'}
        const response = await request(options);

    })
})