
const { uuid } = require('@hkube/uid');
const { expect } = require('chai');
const storageManager = require('@hkube/storage-manager');
const storageHelper = require('../lib/storage/storage');
let config;

function getConfig() {
    const jobId = 'jobId:' + uuid();
    const taskId = 'taskId:' + uuid();
    return {
        taskId,
        jobId,
    };
}

describe('StorageHelper', () => {
    describe('StorageV1', () => {
        before(async function () {
            config = testParams.config;
            storageHelper.init(config);
            storageHelper.setStorageType('v1')
        });
        xit('store data and validate extraction no cache', async () => {
            const config = getConfig();
            const taskId1 = config.taskId + "-1";
            const taskId2 = config.taskId + "-2";
            const discovery = { host: '127.0.0.1', port: 9020 }
            const link1 = await storageManager.hkube.put({ jobId: config.jobId, taskId: taskId1, data: { data: { engine: 'deep' } } });
            const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: taskId2, data: { myValue: 1973 } });
            const data = {
                input: ['test-param', true, 12345, '$$guid-5'],
                storage: {
                    'guid-5': [
                        { storageInfo: link1, discovery, taskId: taskId1, path: 'data.engine' },
                        { storageInfo: link2, discovery, taskId: taskId2, path: 'myValue' }
                    ]
                },
                startSpan: () => { }
            }
            const result = await storageHelper.extractData({ ...data, ...config });
            expect(result.data.input).to.eql(['test-param', true, 12345, ['deep', 1973]]);
        });
        it('Extraction with empty storage', async () => {
            const data = {
                input: ['test-param', true, 12345],
                storage: {
                },
                startSpan: () => { }
            }
            const result = await storageHelper.extractData(data);
            expect(result.data.input).to.eql(['test-param', true, 12345]);
        });
        it('store data and validate extraction using cache', async () => {
            const config = getConfig();
            const link = await storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } });
            const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "5", data: { myValue: 1973 } });
            const data = {
                input: ['test-param', true, 12345, '$$guid-5', '$$guid-6'],
                storage: {
                    'guid-5': { storageInfo: link, path: 'data.engine' },
                    'guid-6': { storageInfo: link2, path: 'myValue' }
                },
                startSpan: () => { }
            }
            const result1 = await storageHelper.extractData(data);
            expect(result1.data.input).to.eql(['test-param', true, 12345, 'deep', 1973]);
            expect(result1.data.useCache).to.eql(false);

            //Use only cache:
            const data2 = {
                input: ['test-param', true, 12345, '$$guid-1', '$$guid-2'],
                storage: {
                    'guid-2': { storageInfo: link2, path: 'myValue' },
                    'guid-1': { storageInfo: link, path: 'data.engine' }
                },
                startSpan: () => { }
            }
            const result2 = await storageHelper.extractData(data2);
            expect(result2.data.input).to.eql(['test-param', true, 12345, 'deep', 1973]);
            expect(result2.data.useCache).to.eql(true);
        });
        it('store data and validate extraction reseting cache', async () => {
            const config = getConfig();
            const link = await storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } });
            const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "5", data: { myValue: 1973 } });
            const link3 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "6", data: { myOtherValue: 1010 } });

            const data1 = {
                input: ['test-param', true, 12345, '$$guid-5', '$$guid-6'],
                storage: {
                    'guid-5': { storageInfo: link, path: 'data.engine' },
                    'guid-6': { storageInfo: link2, path: 'myValue' }
                },
                startSpan: () => { }
            }
            const result1 = await storageHelper.extractData(data1);
            expect(result1.data.input).to.eql(['test-param', true, 12345, 'deep', 1973]);
            expect(result1.data.useCache).to.eql(false);

            //Use only cache
            const data2 = {
                input: ['test-param', true, 12345, '$$guid-1', '$$guid-2'],
                storage: {
                    'guid-2': { storageInfo: link2, path: 'myValue' },
                    'guid-1': { storageInfo: link, path: 'data.engine' }
                },
                startSpan: () => { }
            }

            const result2 = await storageHelper.extractData(data2);
            expect(result2.data.input).to.eql(['test-param', true, 12345, 'deep', 1973]);
            expect(result2.data.useCache).to.eql(true);

            //Use Storage Manager again
            const data3 = {
                input: ['test-param', true, 12345, '$$guid-1', '$$guid-2'],
                storage: {
                    'guid-2': { storageInfo: link3, path: 'myOtherValue' },
                    'guid-1': { storageInfo: link, path: 'data.engine' }
                },
                startSpan: () => { }
            }
            const result3 = await storageHelper.extractData(data3);
            expect(result3.data.input).to.eql(['test-param', true, 12345, 'deep', 1010]);
            expect(result3.data.useCache).to.eql(false);
        });
    });
});