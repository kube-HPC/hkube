const sinon = require('sinon');
const uuid = require('uuid/v4');
const { expect } = require('chai');
const storageManager = require('@hkube/storage-manager');
const dataExtractor = require('../lib/consumer/data-extractor');



let spy, spy2;

function getConfig() {
    const jobId = 'jobId:' + uuid();
    const taskId = 'taskId:' + uuid();
    return {
        taskId,
        jobId,
    };
}

describe('data-extractor tests', () => {

    afterEach(async function () {
        spy && spy.restore();
        spy2 && spy2.restore();
        dataExtractor.reset();
    });
    it('store data and validate extraction no cache', async () => {
        const config = getConfig();
        const link = await storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } });
        const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "5", data: { myValue: 1973 } });
        spy = sinon.spy(dataExtractor, 'extract');
        spy2 = sinon.spy(storageManager, 'get');
        data = {
            input: ['test-param', true, 12345, '$$guid-5', '$$guid-6'],
            storage: {
                'guid-5': { storageInfo: link, path: 'data.engine' },
                'guid-6': { storageInfo: link2, path: 'myValue' }
            }
        }
        await dataExtractor.extract(data.input, data.storage);
        let storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(2);
        let extractCall = spy.getCalls()[0];
        let value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1973]);
    });
    it('Extraction with empty storage', async () => {
        spy = sinon.spy(dataExtractor, 'extract');
        data = {
            input: ['test-param', true, 12345],
            storage: {
            }
        }
        await dataExtractor.extract(data.input, data.storage);
        let extractCall = spy.getCalls()[0];
        let value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345]);
    });
    it('store data and validate extraction using cache', async () => {
        const config = getConfig();
        const link = await storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } });
        const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "5", data: { myValue: 1973 } });
        const link3 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "6", data: { myOtherValue: 1010 } });

        spy = sinon.spy(dataExtractor, 'extract');
        let spy2 = sinon.spy(storageManager, 'get');
        data = {
            input: ['test-param', true, 12345, '$$guid-5', '$$guid-6'],
            storage: {
                'guid-5': { storageInfo: link, path: 'data.engine' },
                'guid-6': { storageInfo: link2, path: 'myValue' }
            }
        }
        await dataExtractor.extract(data.input, data.storage);
        let storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(2);
        let extractCall = spy.getCalls()[0];
        let value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1973]);
        //Use only cache:
        spy.restore();
        spy2.restore();
        spy = sinon.spy(dataExtractor, 'extract');
        spy2 = sinon.spy(storageManager, 'get');
        data.storage = {
            'guid-2': { storageInfo: link2, path: 'myValue' },
            'guid-1': { storageInfo: link, path: 'data.engine' }
        }
        data.input = ['test-param', true, 12345, '$$guid-1', '$$guid-2'];
        await dataExtractor.extract(data.input, data.storage);
        cc = spy2.getCalls();
        extractCall = spy.getCalls()[0];
        value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1973]);
        storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(0);
    });
    it('store data and validate extraction reseting cache', async () => {
        const config = getConfig();
        const link = await storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } });
        const link2 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "5", data: { myValue: 1973 } });
        const link3 = await storageManager.hkube.put({ jobId: config.jobId, taskId: "6", data: { myOtherValue: 1010 } });

        spy = sinon.spy(dataExtractor, 'extract');
        let spy2 = sinon.spy(storageManager, 'get');
        data = {
            input: ['test-param', true, 12345, '$$guid-5', '$$guid-6'],
            storage: {
                'guid-5': { storageInfo: link, path: 'data.engine' },
                'guid-6': { storageInfo: link2, path: 'myValue' }
            }
        }
        await dataExtractor.extract(data.input, data.storage);
        let storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(2);
        let extractCall = spy.getCalls()[0];
        let value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1973]);
        //Use only cache:
        spy.restore();
        spy2.restore();
        spy = sinon.spy(dataExtractor, 'extract');
        spy2 = sinon.spy(storageManager, 'get');
        data.storage = {
            'guid-2': { storageInfo: link2, path: 'myValue' },
            'guid-1': { storageInfo: link, path: 'data.engine' }
        }
        data.input = ['test-param', true, 12345, '$$guid-1', '$$guid-2'];
        await dataExtractor.extract(data.input, data.storage);
        cc = spy2.getCalls();
        extractCall = spy.getCalls()[0];
        value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1973]);
        storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(0);
        //Use Storage Manager again
        spy.restore();
        spy2.restore();
        spy = sinon.spy(dataExtractor, 'extract');
        spy2 = sinon.spy(storageManager, 'get');
        data.storage = {
            'guid-2': { storageInfo: link3, path: 'myOtherValue' },
            'guid-1': { storageInfo: link, path: 'data.engine' }
        }
        await dataExtractor.extract(data.input, data.storage);
        cc = spy2.getCalls();
        extractCall = spy.getCalls()[0];
        value = await extractCall.returnValue
        expect(value).to.eql(['test-param', true, 12345, 'deep', 1010]);
        storageManagerCalls = spy2.getCalls();
        expect(storageManagerCalls.length).to.eql(2);
    });
});