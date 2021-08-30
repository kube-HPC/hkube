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
let db;

describe('StateManager', function () {
    before(async () => {
        stateManager = require('../lib/state/state-manager');
        db = require('../lib/state/db');
    });
    it('setJobResults', async function () {
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
        const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
        const res = await storageManager.get(etcdResult.data.storageInfo);
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
        const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
        const res = await storageManager.get(etcdResult.data.storageInfo);
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
        const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
        const res = await storageManager.get(etcdResult.data.storageInfo);
        expect(data).to.deep.equal(res[0].result);
    });
    it('setJobStatus', async function () {
        const jobId = createJobId();
        const data = { status: 'completed' };
        await stateManager._etcd.jobs.status.set({ jobId, data });
        const response = await stateManager._etcd.jobs.status.get({ jobId });
        expect(response.data).to.deep.equal(data);
    });
    it('should update state correctly', async function () {
        let resolve;
        const promise = new Promise((res) => { resolve = res });
        const jobId = createJobId();
        const statusActive = { jobId, status: pipelineStatuses.ACTIVE };
        const statusStopped = { jobId, status: pipelineStatuses.STOPPED };
        await stateManager._etcd.jobs.status.set(statusActive);
        await stateManager.createJob({ jobId, status: { status: statusActive.status } });

        const interval = setInterval(async () => {
            await stateManager.setJobStatus(statusActive);
        }, 10);
        setTimeout(async () => {
            clearInterval(interval);
            await db.updateStatus(statusStopped);
            await stateManager._etcd.jobs.status.update(statusStopped);
            resolve();
        }, 200);

        await promise;
        const res1 = await db.fetchStatus({ jobId });
        const res2 = await stateManager._etcd.jobs.status.get({ jobId });
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
            await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: data.error, status: data.status });
            setTimeout(() => {
                resolve();
            }, 1000)
        });
    });
    it('watchJobStatus', function () {
        return new Promise(async (resolve, reject) => {
            const jobId = createJobId();
            const status = DriverStates.STOPPED;
            await stateManager.watchJobStatus({ jobId });
            stateManager.onJobStop((response) => {
                if (response.jobId === jobId) {
                    expect(response.jobId).to.equal(jobId);
                    expect(response.status).to.equal(status);
                    resolve();
                }
            });
            await stateManager._etcd.jobs.status.set({ jobId, status });
        });
    });
    it('unWatchJobState', function () {
        return new Promise(async (resolve, reject) => {
            const jobId = createJobId();
            await stateManager.watchJobStatus({ jobId });
            stateManager.onJobStop(() => {
                throw new Error('failed');
            });
            await stateManager.unWatchJobStatus({ jobId });
            await stateManager._etcd.jobs.status.set({ jobId, status: DriverStates.STOPPED });
            setTimeout(() => {
                resolve();
            }, 1000)
        });
    });
});