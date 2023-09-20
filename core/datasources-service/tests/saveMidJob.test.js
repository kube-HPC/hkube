const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const waitFor = require('./waitFor');
const pathLib = require('path');
const { getDatasourcesInUseFolder } = require('../lib/utils/pathUtils');
const {
    createDataSource,
    createJob,
} = require('./api');
const { request } = require('./request');
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
function sleep(sleepTime){
    return new Promise(res => setTimeout(res, sleepTime));
}

describe('Save Mid Pipeline', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
        storageManager = require('@hkube/storage-manager');
        rootDir = getDatasourcesInUseFolder(global.testParams.config);
        restUrl = global.testParams.restUrl;
    
    });
    after(async () => {
        await fse.remove(rootDir);
    });

    it('should add new file to the dvc track', async () => {
        const name = uuid();
        const { body: dataSource } = await createDataSource(name, {
            fileNames: ['logo.svg', 'logo.svg.meta'],
        });
        const job = await createJob({ dataSource });
        const { jobId, nodeName } = job.data;
        const dsPath = pathLib.join(rootDir, jobId, name, 'complete');
        const newFilePath = pathLib.join(dsPath, 'data', 'a.txt');
        let triesCount = 0;
        while( true ){
            if (await fse.pathExists(pathLib.join(dsPath, 'data'))){
                break;
            }
            else{
                await sleep(1000);
                triesCount+=1;
            }
            if (triesCount > 10){
                throw Error(`path ${dsPath} is not being created by job`)
            }
        }
        await fse.outputFile(newFilePath, 'testing');
        const options = {
            uri: `${restUrl}/datasource/${jobId}/${name}/${nodeName}`,
            method: 'POST'}
        const response = await request(options);
        expect(response.response.statusCode).to.eq(200);
        expect(response.body).to.be.an('object');
        expect(response.body.name).to.eq(name);
        expect(response.body.files).to.be.an('array');
        const nameList = response.body.files.map(file => file.name);
        expect(nameList).to.include('a.txt');
        const aFile = response.body.files.filter(file => file.name === 'a.txt');
        expect(aFile[0].meta).to.eq('');
        
    })
})