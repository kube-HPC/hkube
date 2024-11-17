const delay = require('delay');
const { expect } = require('chai');
const { uid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const streamHandler = require('../lib/streaming/services/stream-handler');
const streamService = require('../lib/streaming/services/stream-service');
const discovery = require('../lib/streaming/services/service-discovery');
const SlaveAdapter = require('../lib/streaming/adapters/slave-adapter');
const pipeline = require('./mocks/pipeline.json');
const SEC = 1000;

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
        childs: ['D', 'E', 'F'],
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

/**
 * Adjusts the `data` object by adding rate-related statistics from the `reqRateInfo`
 * parameter, then reports the updated statistics via `streamService` or the optional `slave` parameter, 
 * and introduces a delay. The operation is repeated `repeatCount` times.
 * 
 * Note - `reqRate` is calculated as Δ count / Δ time, meaning `(queueSize + sent) / delayTime`.
 * When `delayTime` is 1000 (1 second), this gives the exact `reqRate`.
 * 
 * @async
 * @param {Object} data - The data object holding current statistics, to be updated.
 * @param {Object} [reqRateInfo={}] - Rate-related information to be added to `data`.
 * @param {number} [reqRateInfo.queueSize=0] - The number of items in the request queue to be added.
 * @param {number} [reqRateInfo.sent=0] - The number of requests sent, to be added to `data.sent`.
 * @param {number} [reqRateInfo.delayTime=0] - The delay time (in milliseconds) to wait after each report.
 * @param {number} [repeatCount=1] - The number of times to repeat the scaling and reporting operation.
 * @param {Object} [slave=undefined] - Optional object with a `report` method, used for reporting statistics.
 *                                       If provided, its `report` method is called with `data`.
 *                                       If not provided, `streamService.reportStats` is used.
 * 
 * @returns {Promise<void>} - Resolves after completing the specified number of repetitions.
 */
const scale = async (data, reqRateInfo = {}, repeatCount = 1, slave = undefined) => {
    const { queueSize = 0, sent = 0, delayTime = 0 } = reqRateInfo;
    for (let i = 0; i < repeatCount; i++) {
        data.queueSize = (data.queueSize || 0) + queueSize;
        data.sent = (data.sent || 0) +  sent;
        slave ? slave.report(data) : streamService.reportStats([data]);
        if (delayTime > 0) {
            await delay(delayTime);
        }
    }
};

const msgPerSec = 50; // Equals pod rate
const duration = SEC / msgPerSec;
const durations = Array.from(Array(10).fill(duration));

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
        const replicasOnFirstScale = require('../config/main/config.base.js').streaming.autoScaler.scaleUp.replicasOnFirstScale;

        it('should not scale based on no data', async () => {
            const data = {
                nodeName: 'D',
            }

            await scale(data);
            const { required } = autoScale(data.nodeName);
            expect(required).to.equal(0, `required=${required}, suppose to be 0`);
        });

        it('should init scale when there is a queue', async () => {
            const data = {
                nodeName: 'D',
                queueSize: 1
            }

            await scale(data);
            const { required } = autoScale(data.nodeName);
            expect(required).to.equal(replicasOnFirstScale, `required=${required}, suppose to be ${replicasOnFirstScale}`);
        });

        it('should init scale when there is request rate', async () => {
            const data = {
                nodeName: 'D',
                sent: 10
            }
            const reqRateInfo = {
                sent: 1,
                delayTime: 10
            }

            await scale(data, reqRateInfo, 2);
            const { required } = autoScale(data.nodeName);
            expect(required).to.equal(replicasOnFirstScale, `required=${required}, suppose to be ${replicasOnFirstScale}`);
        });

        it('should init scale to minimum requirement, when there is a queue', async () => {
            const data = {
                nodeName: 'E',
                queueSize: 1
            }

            await scale(data);
            const { required } = autoScale(data.nodeName);
            const min = pipeline.nodes.filter((node) => data.nodeName === node.nodeName)[0].minStatelessCount;
            expect(required).to.be.equal(min, `required=${required}, suppose to be ${min}`);
        });

        it('should init scale and not pass maximum requirement, when there is a queue', async () => {
            const data = {
                nodeName: 'F',
                queueSize: 1
            }

            await scale(data);
            const { required } = autoScale(data.nodeName);
            const max = pipeline.nodes.filter((node) => data.nodeName === node.nodeName)[0].maxStatelessCount;
            expect(required).to.be.equal(max, `required=${required}, suppose to be ${max}`);
        });

        it('should scale up based on roundTrip, queueSize, currentSize', async () => {
            const data = {
                nodeName: 'D',
                currentSize: 1,
                durations
            }
            const reqRateInfo = {
                queueSize: 20,
                delayTime: 50
            }

            await scale(data, reqRateInfo, 4);
            await delay(500);
            const { required } = autoScale(data.nodeName);
            expect(required).to.be.gte(8, `required is ${required}, suppose to be 8-9`);
            expect(required).to.be.lte(9, `required is ${required}, suppose to be 8-9`);
        });

        it('should scale up based on all params', async () => {
            const data = {
                nodeName: 'D',
                currentSize: 1,
                durations
            }
            const reqRateInfo = {
                queueSize: 15,
                sent: 5,
                delayTime: 50
            }

            await scale(data, reqRateInfo, 4);
            await delay(500);
            const { required } = autoScale(data.nodeName);
            expect(required).to.be.gte(8, `required is ${required}, suppose to be 8-9`);
            expect(required).to.be.lte(9, `required is ${required}, suppose to be 8-9`);
        });

        it('should scale up based on all params, when currentSize is 0 and there are responses already', async () => {
            const data = {
                nodeName: 'D',
                currentSize: 0,
                durations,
                responses: 1
            }
            const reqRateInfo = {
                queueSize: 15,
                sent: 5,
                delayTime: 50
            }

            await scale(data, reqRateInfo, 4);
            await delay(500);
            const { required } = autoScale(data.nodeName);
            expect(required).to.be.gte(8, `required is ${required}, suppose to be 8-9`);
            expect(required).to.be.lte(9, `required is ${required}, suppose to be 8-9`);
        });

        it('should scale up based on all params, and there are responses already, and not exceeding max stateless', async () => {
            const data = {
                nodeName: 'F',
                currentSize: 1,
                durations,
                responses: 1
            }
            const reqRateInfo = {
                queueSize: 3,
                sent: 1,
                delayTime: 10
            }

            await scale(data, reqRateInfo, 4);
            const { required } = autoScale(data.nodeName);
            const max = pipeline.nodes.filter((node) => data.nodeName === node.nodeName)[0].maxStatelessCount;
            expect(required).to.equal(max, `required is ${required}, suppose to be ${max}`);
        });

        it('should scale up based on all params, and there are responses already, and have min stateless', async () => {
            const data = {
                nodeName: 'E',
                currentSize: 1,
                durations,
                responses: 1
            }
            const reqRateInfo = {
                queueSize: 1,
                sent: 1,
                delayTime: 10
            }

            await scale(data, reqRateInfo, 4);
            const { required } = autoScale(data.nodeName);
            const min = pipeline.nodes.filter((node) => data.nodeName === node.nodeName)[0].minStatelessCount;
            expect(required).to.equal(min, `required is ${required}, suppose to be ${min}`);
        });
    });
    
    describe('scale-down', () => {
        it('should scale down based on roundTrip, queueSize, currentSize', async () => {
            const data = {
                nodeName: 'D',
                currentSize: 100,
                durations
            }
            const reqRateInfo = {
                queueSize: 20,
                delayTime: 50
            }

            await scale(data, reqRateInfo, 4);
            await delay(500);
            const { required } = autoScale(data.nodeName);
            expect(required).to.be.gte(8, `required is ${required}, suppose to be 8-9`);
            expect(required).to.be.lte(9, `required is ${required}, suppose to be 8-9`);
        });

        it('should scale down based on all params', async () => {
            const data = {
                nodeName: 'D',
                currentSize: 100,
                durations
            }
            const reqRateInfo = {
                queueSize: 15,
                sent: 5,
                delayTime: 50
            }

            await scale(data, reqRateInfo, 4);
            const { required } = autoScale(data.nodeName);
            expect(required).to.be.gte(8, `required is ${required}, suppose to be 8-9`);
            expect(required).to.be.lte(9, `required is ${required}, suppose to be 8-9`);
        });

        it('should scale up based on all params, and there are responses already, and have min stateless', async () => {
            const data = {
                nodeName: 'E',
                currentSize: 20,
                durations,
                responses: 1
            }
            const reqRateInfo = {
                queueSize: 1,
                sent: 1,
                delayTime: 10
            }

            await scale(data, reqRateInfo, 4);
            const { required } = autoScale(data.nodeName);
            const min = pipeline.nodes.filter((node) => data.nodeName === node.nodeName)[0].minStatelessCount;
            expect(required).to.equal(min, `required is ${required}, suppose to be ${min}`);
        });
    });

    describe('scale-conflicts', () => {
        it('should only scale up based on master', async () => {
            const nodeName = 'D';
            const currentSize = 0;
            const slave = new SlaveAdapter({ jobId, nodeName, source: 'B' });
            const data1 = {
                nodeName,
                queueSize: 150,
                responses: 30,
                sent: 30,
                durations,
                currentSize
            }
            const data2 = {
                nodeName,
                queueSize: 4500,
                responses: 150,
                sent: 150,
                durations,
                currentSize
            }
            const reqRateInfo = {
                queueSize: 20,
                sent: 10,
                delayTime: 50
            }

            await scale(data1, reqRateInfo, 4);
            await scale(data2, reqRateInfo, 4, slave);
            await delay(1000);
            const { required } = autoScale(nodeName);
            expect(required).to.be.equal(28, `required is ${required}, suppose to be 28`);
        });

        it('should not scale up based on avg master and slaves', async () => {
            const nodeName = 'D';
            const currentSize = 0;
            const data1 = {
                nodeName,
                queueSize: 300,
                responses: 40,
                sent: 40,
                durations,
                currentSize
            }
            const data2 = {
                nodeName,
                queueSize: 300,
                responses: 60,
                sent: 60,
                durations,
                currentSize
            }
            const data3 = {
                nodeName,
                queueSize: 300,
                responses: 80,
                sent: 80,
                durations,
                currentSize
            }
            const data4 = {
                nodeName,
                queueSize: 300,
                responses: 100,
                sent: 100,
                durations,
                currentSize
            }
            const reqRateInfo = {
                queueSize: 20,
                sent: 10,
                delayTime: 50
            }

            const slave1 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave2 = new SlaveAdapter({ jobId, nodeName, source: 'B' });
            const slave3 = new SlaveAdapter({ jobId, nodeName, source: 'C' });
            const slave4 = new SlaveAdapter({ jobId, nodeName, source: 'D' });
            await scale(data1, reqRateInfo, 4, slave1);
            await scale(data2, reqRateInfo, 4, slave2);
            await scale(data3, reqRateInfo, 4, slave3);
            await scale(data4, reqRateInfo, 4, slave4);
            await delay(1000);
            const { required } = autoScale(nodeName);
            expect(required).to.be.gte(49, `required is ${required}, suppose to be 49-50`);
            expect(required).to.be.lte(50, `required is ${required}, suppose to be 49-50`);
        });
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
                durations
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
            const { requests, responses, grossDurations } = stats;
            const maxSizeWindow = testParams.config.streaming.autoScaler.statistics.maxSizeWindow;
            expect(requests.items).to.have.lengthOf(maxSizeWindow);
            expect(responses.items).to.have.lengthOf(maxSizeWindow);
            expect(grossDurations.items).to.have.lengthOf(maxSizeWindow * 10);
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
            const list = [{ nodeName, queueSize: 150, responses: 30, currentSize }];
            const list1 = { nodeName, queueSize: 300, responses: 80, currentSize };
            const list2 = { nodeName, queueSize: 450, responses: 140, currentSize };
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
