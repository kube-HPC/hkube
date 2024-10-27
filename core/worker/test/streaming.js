const delay = require('delay');
const { expect } = require('chai');
const { uid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const streamHandler = require('../lib/streaming/services/stream-handler');
const streamService = require('../lib/streaming/services/stream-service');
const discovery = require('../lib/streaming/services/service-discovery');
const SlaveAdapter = require('../lib/streaming/adapters/slave-adapter');
const SEC = 1000;

const pipeline = {
    name: "stream",
    kind: "stream",
    nodes: [
        {
            nodeName: "A",
            algorithmName: "eval-alg",
            input: [
                "@flowInput.arraySize",
                "@flowInput.bufferSize"
            ],
            stateType: "stateful"
        },
        {
            nodeName: "B",
            algorithmName: "eval-alg",
            input: [
                "@flowInput.arraySize",
                "@flowInput.bufferSize"
            ],
            stateType: "stateful"
        },
        {
            nodeName: "C",
            algorithmName: "eval-alg",
            input: [
                "@flowInput.arraySize",
                "@flowInput.bufferSize"
            ],
            stateType: "stateful"
        },
        {
            nodeName: "D",
            algorithmName: "eval-alg",
            input: [],
            stateType: "stateless"
        },
        {
            nodeName: "E",
            algorithmName: "eval-alg",
            input: [],
            stateType: "stateless"
        },
        {
            nodeName: "F",
            algorithmName: "eval-alg",
            input: [],
            stateType: "stateless",
            maxStatelessCount: 3,
            minStatelessCount: 1
        }
    ],
    edges: [
        { source: "A", target: "D" },
        { source: "B", target: "D" },
        { source: "C", target: "D" },
        { source: "A", target: "E" },
        { source: "B", target: "E" },
        { source: "C", target: "F" }
    ],
    flowInputMetadata: {
        metadata: {
            "flowInput.arraySize": {
                "type": "number"
            },
            "flowInput.bufferSize": {
                "type": "number"
            }
        },
        storageInfo: {
            "path": "local-hkube/main:streaming:9dy12jfh/main:streaming:9dy12jfh"
        }
    }
}

const streamingDiscovery = {
    host: process.env.POD_IP || '127.0.0.1',
    port: process.env.STREAMING_DISCOVERY_PORT || 9022
};

const addDiscovery = async ({ jobId, nodeName, port }) => {
    stateAdapter._etcd.discovery._client.leaser._lease = null;
    const instanceId = uid({ length: 10 });
    await stateAdapter._etcd.discovery.register({
        data: {
            jobId,
            taskId: uid(),
            nodeName,
            workerStatus: 'working',
            streamingDiscovery: { ...streamingDiscovery, port }
        },
        instanceId
    });
    return instanceId;
};

const deleteDiscovery = async ({ instanceId }) => {
    await stateAdapter._etcd.discovery.delete({ instanceId });
};

const getMasters = () => {
    return streamService._adapters.getMasters();
}

const jobId = uid();

const createJob = (jobId) => {
    const job = {
        jobId,
        kind: 'stream',
        taskId: uid(),
        nodeName: 'C',
        algorithmName: 'my-alg',
        pipelineName: 'my-pipe',
        parents: [],
        childs: ['D','F'],
    };
    return job;
};

const job = createJob(jobId);

const autoScale = (nodeName) => {
    let master = getMasters();
    master = master.filter(m => m.nodeName === nodeName);
    master[0].scale();
    return {
        required: master[0]._autoScaler._scaler.required
    };
}

const checkMetrics = () => {
    return streamService._metrics._checkMetrics() || [];
}

const msgPerSec = 30;
const duration = SEC / msgPerSec;
const netDurations = Array.from(Array(10).fill(duration));

describe('Streaming', () => {
    before(async () => {
        await stateAdapter._db.jobs.create({ pipeline, jobId });
        await streamHandler.start(job);
    });
    beforeEach(() => {
        const masters = getMasters();
        masters.map(m => m.reset());
    })
    describe('scale-up', () => {
        it('should not scale based on no data', async () => {
            const scale = async (data) => {
                streamService.reportStats(data);
            }
            const list = [{
                nodeName: 'D',
            }];
            await scale(list);
            const { required } = autoScale(list[0].nodeName);
            expect(required).to.equal(0);
        });
        it('should init scale when there is a queue', async () => {
            const scale = async (data) => {
                streamService.reportStats(data);
            }
            const list = [{
                nodeName: 'D',
                queueSize: 1,
                netDurations
            }];
            await scale(list);
            const { required } = autoScale(list[0].nodeName);
            expect(required).to.gte(1);
        });
        it('should init scale when there is request rate', async () => {
            const scale = async (data) => {
                data[0].sent += 10;
                streamService.reportStats(data);
                await delay(100);
            }
            const list = [{
                nodeName: 'D',
                sent: 10,
                queueSize: 0,
                netDurations
            }];
            await scale(list);
            await scale(list);
            const { required } = autoScale(list[0].nodeName);
            expect(required).to.equal(1);
        });
        // it.only('should not scale if currentSize is fixed', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const currentSize = async (data) => {
        //         data[0].currentSize = 5;
        //         data[0].queueSize += 500;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         queueSize: 500,
        //         netDurations
        //     }];

        //     await scale(list);
        //     const jobs1 = autoScale(list[0].nodeName);
        //     const jobs2 = autoScale(list[0].nodeName);
        //     const jobs3 = autoScale(list[0].nodeName);
        //     await currentSize(list);
        //     const jobs4 = autoScale(list[0].nodeName);
        //     const jobs5 = autoScale(list[0].nodeName);
        //     expect(jobs1.required).to.gte(1);
        //     expect(jobs2.required).to.gte(1);
        //     expect(jobs3.required).to.gte(1);
        //     expect(jobs4.required).to.gte(30);
        //     expect(jobs5.required).to.gte(30);
        // });
        // it('should scale based on queueSize only', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         streamService.reportStats(data);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         queueSize: 500,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await scale(list);
        //     const { required } = autoScale(list[0].nodeName);
        //     expect(required).to.gte(1);
        // });
        // it.only('should scale based on all params', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP (NOT GIVEN HERE)
        //     const queueSize = 0;
        //     const responses = 0;
        //     const currentSize = 0;

        //     const scale = async (data) => {
        //         data[0].queueSize += 200;
        //         data[0].responses += 1;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         queueSize,
        //         currentSize,
        //         netDurations,
        //         responses
        //     }];
        //     await scale(list);
        //     await scale(list);
        //     await scale(list);
        //     await scale(list);
        //     const scale1 = autoScale(list[0].nodeName);
        //     const scale2 = autoScale(list[0].nodeName);
        //     const scale3 = autoScale(list[0].nodeName);
        //     expect(scale1.required).to.gte(20);
        //     expect(scale2.required).to.gte(20);
        //     expect(scale3.required).to.gte(20);
        // }).timeout(1000000000000);
        // it('should scale based on queueSize and responses only', async () => {  // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         streamService.reportStats(data);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         queueSize: 500,
        //         responses: 100,
        //         netDurations
        //     }];
        //     await scale(list);
        //     const { required } = autoScale(list[0].nodeName);
        //     expect(required).to.gte(2);
        // });
        // it.only('should scale up based on high req/res rate', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const nodeName = 'D';
        //     const requests = async (data) => {
        //         data[0].currentSize = 0;
        //         data[0].queueSize += 200;
        //         data[0].responses = 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         sent: 0,
        //         queueSize: 0,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await requests(list);
        //     await requests(list);
        //     await requests(list);
        //     const { required } = autoScale(list[0].nodeName);
        //     expect(required).to.gte(30);
        // });
        // it('should scale based on high durations', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         data[0].sent += 400;
        //         data[0].responses += 30;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         sent: 0,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await scale(list);
        //     await scale(list);
        //     await scale(list);
        //     const { required } = autoScale(list[0].nodeName);
        //     expect(required).to.gte(10);
        // });
        // it('should scale based on low durations', async () => {  // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         data[0].sent += 100;
        //         data[0].responses += 0;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         sent: 0,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await scale(list);
        //     await scale(list);
        //     await scale(list);
        //     const { required } = autoScale(list[0].nodeName);
        //     expect(required).to.gte(1);
        // });
        // it('should scale only up based on req/res rate', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP 
        //     const scale = async (data) => {
        //         data[0].sent += 10;
        //         data[0].responses += 3;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const increaseSize = async (data) => {
        //         data[0].responses += 1;
        //         data[0].currentSize += 2;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const list = [{
        //         nodeName: 'D',
        //         sent: 10,
        //         queueSize: 0,
        //         currentSize: 0,
        //         netDurations,
        //         responses: 3
        //     }];
        //     await scale(list);
        //     await scale(list);
        //     const jobs1 = autoScale(list[0].nodeName);
        //     await increaseSize(list);
        //     const jobs2 = autoScale(list[0].nodeName);
        //     await increaseSize(list);
        //     autoScale(list[0].nodeName);
        //     const jobs3 = autoScale(list[0].nodeName);
        //     await scale(list);
        //     await scale(list);
        //     const jobs4 = autoScale(list[0].nodeName);
        //     const jobs5 = autoScale(list[0].nodeName);
        //     const jobs6 = autoScale(list[0].nodeName);
        //     expect(jobs1.required).to.gte(4);
        //     expect(jobs2.required).to.gte(4);
        //     expect(jobs3.required).to.gte(4);
        //     expect(jobs4.required).to.gte(4);
        //     expect(jobs5.required).to.gte(4);
        //     expect(jobs6.required).to.gte(4);
        // });
        // it('should scale only up based on req/res rate with a maxStatelessCount limit', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const scale = async (data) => {
        //         data[0].sent += 10;
        //         data[0].responses += 3;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const increaseSize = async (data) => {
        //         data[0].responses += 1;
        //         data[0].currentSize += 2;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const list = [{
        //         nodeName: 'F',
        //         sent: 10,
        //         queueSize: 0,
        //         currentSize: 0,
        //         netDurations,
        //         responses: 3
        //     }];
        //     const scaledNode = pipeline.nodes[5]
        //     await scale(list);
        //     await scale(list);
        //     const jobs1 = autoScale(list[0].nodeName);
        //     await increaseSize(list);
        //     const jobs2 = autoScale(list[0].nodeName);
        //     await increaseSize(list);
        //     autoScale(list[0].nodeName);
        //     const jobs3 = autoScale(list[0].nodeName);
        //     await scale(list);
        //     await scale(list);
        //     const jobs4 = autoScale(list[0].nodeName);
        //     const jobs5 = autoScale(list[0].nodeName);
        //     const jobs6 = autoScale(list[0].nodeName);
        //     expect(jobs1.required).to.eql(scaledNode.maxStatelessCount);
        //     expect(jobs2.required).to.eql(scaledNode.maxStatelessCount);
        //     expect(jobs3.required).to.eql(scaledNode.maxStatelessCount);
        //     expect(jobs4.required).to.eql(scaledNode.maxStatelessCount);
        //     expect(jobs5.required).to.eql(scaledNode.maxStatelessCount);
        //     expect(jobs6.required).to.eql(scaledNode.maxStatelessCount);
        // });
    });
    
    describe('scale-down', () => {
        // it('should scale up and down based on durations', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const nodeName = 'D';
        //     const requestsUp = async (data) => {
        //         data[0].queueSize += 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const responsesUp = async (data) => {
        //         data[0].responses += 100;
        //         data[0].sent = 200;
        //         data[0].queueSize = 0;
        //         data[0].currentSize += 1;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         currentSize: 0,
        //         sent: 0,
        //         queueSize: 0,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await requestsUp(list);
        //     await requestsUp(list);
        //     const jobs1 = autoScale(list[0].nodeName);
        //     const jobs2 = autoScale(list[0].nodeName);
        //     await delay(200)
        //     await responsesUp(list);
        //     await responsesUp(list);
        //     const jobs3 = autoScale(list[0].nodeName);
        //     const jobs4 = autoScale(list[0].nodeName);
        //     expect(jobs1.required).to.gte(1);
        //     expect(jobs2.required).to.gte(1);
        //     expect(jobs3.required).to.gte(7);
        //     expect(jobs4.required).to.gte(7);
        // });
        // it('should scale up and down based on no requests and no responses', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP 
        //     const nodeName = 'D';
        //     const requestsUp = async (data) => {
        //         data[0].sent = 100;
        //         data[0].responses = 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         currentSize: 0,
        //         sent: 0,
        //         responses: 0,
        //         netDurations
        //     }];
        //     await requestsUp(list);
        //     await requestsUp(list);
        //     await requestsUp(list);
        //     await requestsUp(list);
        //     const scale = autoScale(list[0].nodeName);
        //     expect(scale.required).to.eql(0);
        // });
        // it('should scale down based on zero ratio', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const nodeName = 'D';
        //     const requests = async (data) => {
        //         data[0].queueSize = 100;
        //         data[0].responses = 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         sent: 0,
        //         currentSize: 5,
        //         queueSize: 0,
        //         responses: 0
        //     }];
        //     await requests(list);
        //     await requests(list);
        //     await requests(list);
        //     await requests(list);
        //     const scale = autoScale(list[0].nodeName);
        //     expect(scale.required).to.eql(0);
        // });
        // it('should not scale down based on responses', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const nodeName = 'D';
        //     const requests = async (data) => {
        //         data[0].currentSize = 5;
        //         data[0].responses += 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         responses: 0
        //     }];
        //     await requests(list);
        //     await requests(list);
        //     await requests(list);
        //     const scale = autoScale(list[0].nodeName);
        //     expect(scale.required).to.eql(0);
        // });
        // it('should not scale down based on currentSize', async () => { // COMMENT SINCE SCALING LOGIC CHANGED, NOW BASED ON ROUND TRIP
        //     const nodeName = 'D';
        //     const requests = async (data) => {
        //         data[0].currentSize = 1;
        //         data[0].queueSize = 0;
        //         data[0].responses += 100;
        //         streamService.reportStats(data);
        //         await delay(100);
        //     }
        //     const list = [{
        //         nodeName,
        //         sent: 0,
        //         queueSize: 0,
        //         responses: 0
        //     }];
        //     await requests(list);
        //     await requests(list);
        //     await requests(list);
        //     const scale = autoScale(list[0].nodeName);
        //     expect(scale.required).to.eql(0);
        // });
    });
    describe('scale-conflicts', () => {
        // it('should only scale up based on master', async () => {
        //     const nodeName = 'D';
        //     const requests = async (data) => {
        //         data[0].queueSize += 100;
        //         data[0].responses += 50;
        //         streamService.reportStats(data);
        //         await delay(50);
        //     }
        //     const reportSlave = async (slave, data) => {
        //         data.queueSize += 100;
        //         data.responses += 50;
        //         slave.report(data);
        //         await delay(50);
        //     }
        //     const currentSize = 0;
        //     const list1 = [{ nodeName, queueSize: 150, responses: 30, netDurations, currentSize }];
        //     const list2 = { nodeName, queueSize: 450, responses: 150, netDurations, currentSize };
        //     const slave = new SlaveAdapter({ jobId, nodeName, source: 'B' });
        //     await requests(list1);
        //     await requests(list1);
        //     await requests(list1);
        //     await requests(list1);
        //     await reportSlave(slave, list2);
        //     await reportSlave(slave, list2);
        //     await reportSlave(slave, list2);
        //     await reportSlave(slave, list2);
        //     const scale = autoScale(nodeName);
        //     expect(scale.required).to.gte(30);
        // });
        // it('should not scale up based on avg master and slaves', async () => {
        //     const nodeName = 'D';
        //     const reportSlave = async (slave, data) => {
        //         data.queueSize += 100;
        //         data.responses += 50;
        //         slave.report(data);
        //         await delay(50)
        //     }
        //     const currentSize = 0;
        //     const list1 = { nodeName, queueSize: 300, responses: 40, netDurations, currentSize };
        //     const list2 = { nodeName, queueSize: 300, responses: 60, netDurations, currentSize };
        //     const list3 = { nodeName, queueSize: 300, responses: 80, netDurations, currentSize };
        //     const list4 = { nodeName, queueSize: 300, responses: 100, netDurations, currentSize };
        //     const slave1 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
        //     const slave2 = new SlaveAdapter({ jobId, nodeName, source: 'B' });
        //     const slave3 = new SlaveAdapter({ jobId, nodeName, source: 'C' });
        //     const slave4 = new SlaveAdapter({ jobId, nodeName, source: 'D' });
        //     await reportSlave(slave1, list1);
        //     await reportSlave(slave1, list1);
        //     await reportSlave(slave1, list1);
        //     await reportSlave(slave1, list1);

        //     await reportSlave(slave2, list2);
        //     await reportSlave(slave2, list2);
        //     await reportSlave(slave2, list2);
        //     await reportSlave(slave2, list2);

        //     slave3.report(list3);
        //     slave3.report(list3);
        //     slave3.report(list3);
        //     slave3.report(list3);

        //     slave4.report(list4);
        //     slave4.report(list4);
        //     slave4.report(list4);
        //     slave4.report(list4);
        //     await delay(200);
        //     const scale = autoScale(nodeName);
        //     expect(scale.required).to.gte(30);
        // });
    });
    describe('no-scale', () => {
        it('should not scale when no relevant data', async () => {
            const reportStats = async (data) => {
                streamService.reportStats(data);
                await delay(100);
            }
            const list = [{
                nodeName: 'D'
            }];
            await reportStats(list);
            await reportStats(list);
            await reportStats(list);
            const scale = autoScale(list[0].nodeName);
            expect(scale.required).to.eql(0);
        });
        it('should not over the maxSizeWindow', async () => {
            const nodeName = 'D';
            const data = [{
                nodeName,
                queueSize: 10,
                netDurations
            }];
            streamService.reportStats(data);
            streamService.reportStats(data);
            streamService.reportStats(data);
            streamService.reportStats(data);
            streamService.reportStats(data);
            streamService.reportStats(data);
            let masters = getMasters();
            masters = masters.filter(m => m.nodeName === nodeName);
            const statsData = masters[0]._autoScaler._statistics._data;
            const key = Object.keys(statsData)[0];
            const stats = statsData[key];
            const { requests, responses, durations } = stats;
            const maxSizeWindow = testParams.config.streaming.autoScaler.statistics.maxSizeWindow;
            expect(requests.items).to.have.lengthOf(maxSizeWindow);
            expect(responses.items).to.have.lengthOf(maxSizeWindow);
            expect(durations.items).to.have.lengthOf(maxSizeWindow);
        });
    });
    describe('metrics', () => {
        it('should scale and update metrics', async () => {
            const nodeName = 'D';
            const requests = 30;
            const responses = 10;
            const dropped = 5;
            const scale = async (stats) => {
                stats[0].queueSize += requests
                stats[0].responses += responses;
                stats[0].dropped += dropped;
                streamService.reportStats(stats);
                autoScale(nodeName);
                await delay(20);
            }
            const stat = {
                nodeName,
                queueSize: 0,
                responses: 0,
                dropped: 0
            }
            const stats = [stat];

            await scale(stats);
            const metric1 = checkMetrics()[0];
            await scale(stats);
            const metric2 = checkMetrics()[0];
            await scale(stats);
            const metric3 = checkMetrics()[0];
            const metrics1 = metric1.metrics[0];
            const metrics2 = metric2.metrics[0];
            const metrics3 = metric3.metrics[0];
            const metricsUid1 = metric1.uidMetrics[0];
            const metricsUid2 = metric2.uidMetrics[0];
            const metricsUid3 = metric3.uidMetrics[0];

            expect(metrics1.source).to.eql('C');
            expect(metrics1.target).to.eql('D');
            expect(metricsUid1.totalRequests).to.eql(requests);
            expect(metricsUid1.totalResponses).to.eql(responses);
            expect(metricsUid1.totalDropped).to.eql(dropped);

            expect(metrics2.source).to.eql('C');
            expect(metrics2.target).to.eql('D');
            expect(metricsUid2.totalRequests).to.eql(requests * 2);
            expect(metricsUid2.totalResponses).to.eql(responses * 2);
            expect(metricsUid2.totalDropped).to.eql(dropped * 2);

            expect(metrics3.source).to.eql('C');
            expect(metrics3.target).to.eql('D');
            expect(metricsUid3.totalRequests).to.eql(requests * 3);
            expect(metricsUid3.totalResponses).to.eql(responses * 3);
            expect(metricsUid3.totalDropped).to.eql(dropped * 3);
        });
    });
    describe('master-slaves', () => {
        it('should get slaves', async () => {
            const nodeName = 'D';
            const requests = async (data) => {
                streamService.reportStats(data);
            }
            const currentSize = 2;
            const list = [{ nodeName, queueSize: 150, responses: 30, currentSize }];
            const list1 = { nodeName, queueSize: 300, responses: 80, currentSize };
            const list2 = { nodeName, queueSize: 150, responses: 150, currentSize };
            const slave1 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave2 = new SlaveAdapter({ jobId, nodeName, source: 'B' });
            await requests(list);
            slave1.report(list1);
            slave2.report(list2);
            await delay(500);
            let masters = getMasters();
            masters = masters.filter(m => m.nodeName === nodeName);
            const slaves = masters[0].slaves();
            expect(slaves.sort()).to.deep.equal([slave1.source, slave2.source])
        });
        it('metrics test', async () => {
            const nodeName = 'D';
            const requests = async (data) => {
                data[0].queueSize += 100;
                data[0].responses += 50;
                streamService.reportStats(data);
                await delay(20);
            }
            const reportSlave = async (slave, data) => {
                data.queueSize += 100;
                data.responses += 50;
                slave.report(data);
                await delay(20);
            }
            const currentSize = 0;
            const list = [{ nodeName, queueSize: 150, responses: 30, netDurations, currentSize }];
            const list1 = { nodeName, queueSize: 300, responses: 80, netDurations, currentSize };
            const list2 = { nodeName, queueSize: 450, responses: 140, netDurations, currentSize };
            const slave1 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave2 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave3 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave4 = new SlaveAdapter({ jobId, nodeName, source: 'B' });
            await requests(list);
            await requests(list);
            await requests(list);
            await requests(list);
            await reportSlave(slave1, list1);
            await reportSlave(slave1, list1);
            await reportSlave(slave1, list1);
            await reportSlave(slave1, list1);

            await reportSlave(slave2, list1);
            await reportSlave(slave2, list1);
            await reportSlave(slave2, list1);
            await reportSlave(slave2, list1);

            await reportSlave(slave3, list1);
            await reportSlave(slave3, list1);
            await reportSlave(slave3, list1);
            await reportSlave(slave3, list1);

            await reportSlave(slave4, list2);
            await reportSlave(slave4, list2);
            await reportSlave(slave4, list2);
            await reportSlave(slave4, list2);
            await delay(200);

            autoScale(nodeName);
            const metric = checkMetrics();
            const metrics = metric[0].metrics;

            expect(metrics.map(t => t.source).sort()).to.eql(['A', 'B', 'C']);
            expect(metrics).to.have.lengthOf(3);
        });
        it('should start and finish correctly', async () => {
            expect(streamService._jobData).to.be.not.null;
            expect(streamService._election).to.be.not.null;
            expect(streamService._adapters).to.be.not.null;
            expect(streamService._metrics).to.be.not.null;
            expect(streamService._scalerService).to.be.not.null;
            expect(streamService._active).to.eql(true);
            await streamService.finish(job);
            expect(streamService._jobData).to.be.null;
            expect(streamService._election).to.be.null;
            expect(streamService._adapters).to.be.null;
            expect(streamService._metrics).to.be.null;
            expect(streamService._scalerService).to.be.null;
            await streamService.start(job);
        });
    });
    describe('discovery', () => {
        beforeEach(() => {
            discovery._discoveryMap = Object.create(null);
        });
        it('should add discovery and get right changes', async () => {
            const jobId = uid();
            const nodeName = uid();
            const changes1 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            await addDiscovery({ jobId, nodeName, port: 5001 });
            const changes2 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            expect(changes1).to.have.lengthOf(0);
            expect(changes2).to.have.lengthOf(1);
            expect(changes2[0].type).to.eql('Add');
            expect(changes2[0].nodeName).to.eql(nodeName);
        });
        it('should add discovery multiple times and get right changes', async () => {
            const jobId = uid();
            const nodeName1 = uid();
            const nodeName2 = uid();
            await addDiscovery({ jobId, nodeName: nodeName1, port: 5001 });
            await addDiscovery({ jobId, nodeName: nodeName2, port: 5002 });
            const changes1 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            await addDiscovery({ jobId, nodeName: nodeName1, port: 5003 });
            await addDiscovery({ jobId, nodeName: nodeName2, port: 5004 });
            const changes2 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            expect(changes1).to.have.lengthOf(2);
            expect(changes2).to.have.lengthOf(2);
            expect(changes1[0].type).to.eql('Add');
            expect(changes1[1].type).to.eql('Add');
            expect(changes1[0].nodeName).to.eql(nodeName2);
            expect(changes1[1].nodeName).to.eql(nodeName1);
            expect(changes2[0].type).to.eql('Add');
            expect(changes2[1].type).to.eql('Add');
            expect(changes2[0].nodeName).to.eql(nodeName2);
            expect(changes2[1].nodeName).to.eql(nodeName1);
        });
        it('should add and delete discovery and get right changes', async () => {
            const jobId = uid();
            const nodeName = uid();
            await addDiscovery({ jobId, nodeName, port: 5001 });
            const instanceId1 = await addDiscovery({ jobId, nodeName, port: 5002 });
            const instanceId2 = await addDiscovery({ jobId, nodeName, port: 5003 });
            const changes1 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            await deleteDiscovery({ instanceId: instanceId1 });
            await deleteDiscovery({ instanceId: instanceId2 });
            const changes2 = await discovery._checkDiscovery({ jobId, taskId: uid() });
            expect(changes1).to.have.lengthOf(3);
            expect(changes2).to.have.lengthOf(2);
            expect(changes2[0].type).to.eql('Del');
            expect(changes2[1].type).to.eql('Del');
        });
        it('should add discovery and get right changes', async () => {
            const jobId = uid();
            const nodeName1 = uid();
            const nodeName2 = uid();
            await addDiscovery({ jobId, nodeName: nodeName1, port: 5001 });
            await addDiscovery({ jobId, nodeName: nodeName1, port: 5002 });
            await addDiscovery({ jobId, nodeName: nodeName2, port: 5003 });
            await addDiscovery({ jobId, nodeName: nodeName2, port: 5004 });
            await discovery._checkDiscovery({ jobId, taskId: uid() });
            const count1 = discovery.countInstances(nodeName1);
            const count2 = discovery.countInstances(nodeName2);
            expect(count1).to.eql(2);
            expect(count2).to.eql(2);
        });
    });
});
