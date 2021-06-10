const chai = require('chai');
const path = require('path');
const chaiAsPromised = require('chai-as-promised');
const moment = require('moment');
const storageManager = require('@hkube/storage-manager');
const { expect } = chai;
chai.use(chaiAsPromised);
const adapters = ['s3', 'fs'];
let config, settings, cleaner, cleanerManager;

describe('Storage', () => {
    before(() => {
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('storage');
        config = global.testParams.config;
        settings = config.cleanerSettings.storage.settings;
    });
    adapters.forEach((adapter) => {
        describe(adapter, () => {
            before(async () => {
                const newConfig = { ...config, defaultStorage: adapter };
                storageManager._wasInit = false;
                await storageManager.init(newConfig, null, true);
            });
            it('clean temp objects', async () => {
                await cleaner.clean();

                for (let i = 0; i < 5; i++) {
                    await storageManager.put({ path: path.join('local-hkube-index', moment().subtract(settings.maxAge.temp + i, 'minutes').format(storageManager.hkubeIndex.DateFormat), 'job' + i), data: [] });

                    for (let j = 1; j <= 5; j++) {
                        const jobId = 'job' + i;
                        const taskId = 'task' + j;
                        const data = { test: 'test' + j };
                        await storageManager.hkube.put({ jobId, taskId, data });
                        await storageManager.hkubeMetadata.put({ jobId, taskId, data });
                        await storageManager.hkubeExecutions.put({ jobId, data });
                        await storageManager.hkubeResults.put({ jobId, data });
                    }
                }
                await cleaner.clean();
                for (let i = 0; i < 5; i++) {
                    await storageManager.get({ path: path.join('local-hkube-index', moment().subtract(settings.maxAge.temp + i, 'minutes').format(storageManager.hkubeIndex.DateFormat), 'job' + i) });

                    for (let j = 1; j <= 5; j++) {
                        const jobId = 'job' + i;
                        const taskId = 'task' + j;
                        expect(storageManager.hkube.get({ jobId, taskId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkubeMetadata.get({ jobId, taskId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkubeExecutions.get({ jobId })).to.eventually.rejectedWith(Error);
                        await storageManager.hkubeResults.get({ jobId });
                    }
                }
            });
            it('clean results+temp objects', async () => {
                await cleaner.clean();

                for (let i = 0; i < 5; i++) {
                    await storageManager.put({ path: path.join('local-hkube-index', moment().subtract(settings.maxAge.results + i, 'minutes').format(storageManager.hkubeIndex.DateFormat), 'job' + i), data: [] });

                    for (let j = 1; j <= 5; j++) {
                        const jobId = 'job' + i;
                        const pipelineName = 'pl' + i;
                        const nodeName = 'nn' + i;
                        const taskId = 'task' + j;
                        const fileName = 'fN';
                        const data = { test: 'test' + j };
                        await storageManager.hkube.put({ jobId, taskId, data });
                        await storageManager.hkubeMetadata.put({ jobId, taskId, data });
                        await storageManager.hkubeExecutions.put({ jobId, data });
                        await storageManager.hkubeResults.put({ jobId, data });
                        await storageManager.hkubeAlgoMetrics.put({ jobId, taskId, pipelineName, nodeName, fileName, data })
                    }
                }
                await cleaner.clean();

                for (let i = 0; i < 5; i++) {
                    expect(storageManager.get({ path: path.join('local-hkube-index', moment().subtract(settings.maxAge.results + i, 'minutes').format(storageManager.hkubeIndex.DateFormat), 'job' + i) })).to.eventually.rejectedWith(Error);

                    for (let j = 1; j <= 5; j++) {
                        const jobId = 'job' + i;
                        const taskId = 'task' + j;
                        const pipelineName = 'pl' + i;
                        const nodeName = 'nn' + i;
                        const fileName = 'fN';
                        expect(storageManager.hkubeMetadata.get({ jobId, taskId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkubeExecutions.get({ jobId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkubeResults.get({ jobId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkube.get({ jobId, taskId })).to.eventually.rejectedWith(Error);
                        expect(storageManager.hkubeAlgoMetrics.get({ jobId, taskId, pipelineName, nodeName, fileName })).to.eventually.rejectedWith(Error);
                    }
                }
            });
            it('get and put object', async () => {
                await cleaner.clean();

                for (let i = 0; i < 5; i++) {
                    await storageManager.put({ path: path.join('local-hkube-index', moment().format(storageManager.hkubeIndex.DateFormat), 'jobx' + i), data: [] });
                    await storageManager.hkube.put({ jobId: 'jobx' + i, taskId: 'task1', data: { test: 'test1' } });
                    await storageManager.hkube.put({ jobId: 'jobx' + i, taskId: 'task2', data: { test: 'test2' } });
                    await storageManager.hkube.put({ jobId: 'jobx' + i, taskId: 'task3', data: { test: 'test3' } });
                    await storageManager.hkube.put({ jobId: 'jobx' + i, taskId: 'task4', data: { test: 'test4' } });
                    await storageManager.hkube.put({ jobId: 'jobx' + i, taskId: 'task5', data: { test: 'test5' } });
                }
                await cleaner.clean();

                for (let i = 0; i < 5; i++) {
                    const a = await storageManager.get({ path: path.join('local-hkube-index', moment().format(storageManager.hkubeIndex.DateFormat), 'jobx' + i) });
                    const b = await storageManager.hkube.get({ jobId: 'jobx' + i, taskId: 'task1' });
                    const c = await storageManager.hkube.get({ jobId: 'jobx' + i, taskId: 'task2' });
                    const d = await storageManager.hkube.get({ jobId: 'jobx' + i, taskId: 'task3' });
                    const e = await storageManager.hkube.get({ jobId: 'jobx' + i, taskId: 'task4' });
                    const f = await storageManager.hkube.get({ jobId: 'jobx' + i, taskId: 'task5' });
                    await storageManager.hkube.delete({ jobId: 'jobx' + i });
                }
                await storageManager.hkubeIndex.delete({ date: moment().format(storageManager.hkubeIndex.DateFormat) });
            });
        });
    });
});




