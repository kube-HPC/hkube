const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { uuid } = require('@hkube/uid');
const { request } = require('./utils');
const app = require('../lib/app');
let restUrl;

const jobData = {
    jobId: uuid(),
    taskId: uuid(),
    input: [],
    kind: 'stream',
    stateType: 'stateful',
    nodeName: 'A',
    childs: ['B', 'C'],
    defaultFlow: 'main',
    parsedFlow: {
        main: [{
            source: 'A',
            next: ['B']
        }],
        second: [{
            source: 'A',
            next: ['C']
        }]
    }
}

describe('Gateway', () => {
    before(async () => {
        restUrl = global.testParams.restUrl;
    });
    describe('/streaming/message', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/streaming/message`;
        });
        it('should throw algorithm is not active yet', async () => {
            const options = {
                uri: restPath,
                method: 'POST'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('this algorithm is not active yet');
        });
        it('should throw no such flow', async () => {
            const options = {
                uri: `${restPath}?flow=no_such`,
                method: 'POST'
            };
            const wrapper = app.getWrapper();
            await wrapper._stop({});
            wrapper._init(jobData);
            wrapper._start({});
            const response = await request(options);
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('No such flow no_such');
        });
        it('should succeed to post message', async () => {
            const options = {
                uri: restPath,
                method: 'POST'
            };
            const wrapper = app.getWrapper();
            await wrapper._stop({});
            wrapper._init(jobData);
            wrapper._start({});
            const response = await request(options);
            expect(response.body.message).to.equal('OK');
        });
        it('should succeed to post message with flows', async () => {
            const options1 = {
                uri: `${restPath}?flow=main`,
                method: 'POST'
            };
            const options2 = {
                uri: `${restPath}?flow=second`,
                method: 'POST'
            };
            const wrapper = app.getWrapper();
            await wrapper._stop({});
            wrapper._init(jobData);
            wrapper._start({});
            await request(options1);
            await request(options1);
            await request(options2);
            await request(options2);
            await request(options2);
            const adapter = wrapper._streamingManager._messageProducer._adapter;
            const queueSizeB = adapter.queueSize('B');
            const queueSizeC = adapter.queueSize('C');
            expect(queueSizeB).to.equal(2);
            expect(queueSizeC).to.equal(3);
        });
    });
    describe('/streaming/info', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/streaming/info`;
        });
        it('should get job data as null', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const wrapper = app.getWrapper();
            await wrapper._stop({});
            const response = await request(options);
            expect(response.body.data).to.be.null;
        });
        it('should get job data params', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const wrapper = app.getWrapper();
            await wrapper._stop({});
            wrapper._init(jobData);
            wrapper._start({});
            const response = await request(options);
            expect(response.body.data.jobId).to.eql(jobData.jobId);
            expect(response.body.data.defaultFlow).to.eql(jobData.defaultFlow);
            expect(response.body.data.parsedFlow).to.eql(jobData.parsedFlow);
        });
    });
});
