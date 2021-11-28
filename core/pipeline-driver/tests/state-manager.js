const { uid: uuidv4 } = require('@hkube/uid');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const storageManager = require('@hkube/storage-manager');
chai.use(chaiAsPromised);
const expect = chai.expect;
const { pipelineStatuses } = require('@hkube/consts');
const pipelines = require('./mocks/pipelines');
const DriverStates = require('../lib/state/DriverStates');
const { createJobId } = require('./utils');
let stateManager;

describe('StateManager', function () {
    before(async () => {
        stateManager = require('../lib/state/state-manager');
    });
    it.only('setJobResults', async function () {
        const jobId = createJobId();
        const taskId = `taskId-${uuidv4()}`;
        const data = [{ koko: [1, 2, 3] }];
        const results = {
            jobId,
            data
        };
        const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
        let result = { storageInfo };
        results.data = [{ result }];
        
        const { storageResults } = await stateManager.setJobResultsToStorage(results);
        await stateManager.setJobResults({ jobId, data: storageResults });
        const jobResult = await stateManager.fetchResult({ jobId });
        const res = await storageManager.get(jobResult.data.storageInfo);
        expect(data).to.deep.equal(res[0].result);
    });
    it('setJobResults with null', async function () {
        const jobId = createJobId();
        const taskId = `taskId-${uuidv4()}`;
        const data = [{ koko: [null, 2, 3] }];
        const results = {
            jobId,
            data
        };
        const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
        let result = { storageInfo };
        results.data = [{ result }];
        const { storageResults } = await stateManager.setJobResultsToStorage(results);
        await stateManager.setJobResults({ jobId, data: storageResults });
        const jobResult = await stateManager.fetchResult({ jobId: jobId });
        const res = await storageManager.get(jobResult.data.storageInfo);
        expect(data).to.deep.equal(res[0].result);
    });
    it('setJobResults with error', async function () {
        const jobId = createJobId();
        const taskId = `taskId-${uuidv4()}`;
        const data = [
            {
                "nodeName": "eval1",
                "batchIndex": 1,
                "algorithmName": "eval-alg",
                "error": "Error: no odd numbers"
            },
            {
                "nodeName": "eval1",
                "batchIndex": 2,
                "algorithmName": "eval-alg",
                "result": {
                    "xxx": {}
                }
            }];
        const results = {
            jobId,
            data
        };
        const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
        let result = { storageInfo };
        results.data = [{ result }];
        const { storageResults } = await stateManager.setJobResultsToStorage(results);
        await stateManager.setJobResults({ jobId, data: storageResults });
        const jobResult = await stateManager.fetchResult({ jobId: jobId });
        const res = await storageManager.get(jobResult.data.storageInfo);
        expect(data).to.deep.equal(res[0].result);
    });
    it('should update state correctly', async function () {
        let resolve;
        const promise = new Promise((res) => { resolve = res });
        const jobId = createJobId();
        const statusActive = { jobId, status: pipelineStatuses.ACTIVE };
        const statusStopped = { jobId, status: pipelineStatuses.STOPPED };
        await stateManager.updateStatus(statusActive);
        await stateManager.createJob({ jobId, status: { status: statusActive.status } });

        const interval = setInterval(async () => {
            await stateManager.setJobStatus(statusActive);
        }, 10);
        setTimeout(async () => {
            clearInterval(interval);
            await stateManager.updateStatus(statusStopped);
            resolve();
        }, 200);

        await promise;
        const res1 = await stateManager.fetchStatus({ jobId });
        expect(res1.status).to.eql(statusStopped.status);
        expect(res2.status).to.eql(statusStopped.status);
    });
    it('getExecution', async function () {
        const jobId = createJobId();
        const pipeline = pipelines.find(p => p.name === 'simple-wait-any');
        const options = { jobId, pipeline, status: { status: 'completed' } };
        await stateManager.createJob(options);
        const { jobId: j, ...pipe } = await stateManager.getExecution(options);
        expect(pipe).to.deep.equal(options.pipeline);
    });
    it('unWatchTasks', function () {
        return new Promise(async (resolve, reject) => {
            const jobId = createJobId();
            const taskId = `taskId-${uuidv4()}`;
            const data = { error: 'some different error', status: 'failed' }
            await stateManager.watchTasks({ jobId });
            stateManager.onTaskStatus((data) => {
                if (data.jobId === jobId) {
                    throw new Error('failed');
                }
            });
            await stateManager.unWatchTasks({ jobId });
            await stateManager.updateTask({ jobId, taskId, error: data.error, status: data.status });
            setTimeout(() => {
                resolve();
            }, 1000)
        });
    });
    it('watchJobStatus', function () {
        return new Promise(async (resolve, reject) => {
            const jobId = createJobId();
            const status = DriverStates.STOPPED;
            await stateManager.watchJob({ jobId }, (job) => {
                expect(job.status).to.equal(status);
                resolve();
            });
            await stateManager.createJob({ jobId, status: { status } });
            await stateManager.updateStatus({ jobId, status });
        });
    });
    it('unWatchJobState', function () {
        return new Promise(async (resolve, reject) => {
            const jobId = createJobId();
            await stateManager.watchJob({ jobId });
            stateManager.onJobStop(() => {
                throw new Error('failed');
            });
            await stateManager.unWatchJob({ jobId });
            await stateManager.updateStatus({ jobId, status: DriverStates.STOPPED });
            setTimeout(() => {
                resolve();
            }, 1000)
        });
    });
});