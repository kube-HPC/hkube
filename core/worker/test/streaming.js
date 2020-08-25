const delay = require('delay');
const { expect } = require('chai');
const { uid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const streamHandler = require('../lib/streaming/services/stream-handler');
const streamService = require('../lib/streaming/services/stream-service');
const discovery = require('../lib/streaming/services/service-discovery');
const SlaveAdapter = require('../lib/streaming/adapters/slave-adapter');

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
            stateType: "stateless"
        },
        {
            nodeName: "C",
            algorithmName: "eval-alg",
            input: [
                "@flowInput.arraySize",
                "@flowInput.bufferSize"
            ],
            stateType: "stateless"
        },
        {
            nodeName: "D",
            algorithmName: "eval-alg",
            input: [
                "@A",
                "@B",
                "@C"
            ],
            stateType: "stateless"
        },
        {
            nodeName: "E",
            algorithmName: "eval-alg",
            input: [
                "@A",
                "@B",
            ],
            stateType: "stateless"
        }
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
    port: process.env.STREAMING_DISCOVERY_PORT || 9021
};

const addDiscovery = async ({ jobId, nodeName, port }) => {
    stateAdapter._etcd.discovery._client.leaser._lease = null;
    const instanceId = uid({ length: 10 });
    await stateAdapter._etcd.discovery.register({
        data: {
            jobId,
            taskId: uid(),
            nodeName,
            streamingDiscovery: { ...streamingDiscovery, port }
        },
        instanceId
    });
    return instanceId;
};

const deleteDiscovery = async ({ instanceId }) => {
    await stateAdapter._etcd.discovery.delete({ instanceId });
};

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
        childs: ['D'],
    };
    return job;
};

const job = createJob(jobId);

const autoScale = () => {
    const masters = streamService._adapters._getMasters();
    return masters[0].scale();
}

const checkProgress = () => {
    return streamService._progress._checkProgress();
}

describe.only('Streaming', () => {
    before(async () => {
        await stateAdapter._etcd.executions.running.set({ ...pipeline, jobId });
        await streamHandler.start(job);
    });
    describe('auto-scaler', () => {
        beforeEach(async () => {
            const masters = streamService._adapters._getMasters();
            masters.map(m => m.clean());
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
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp).to.be.null;
                expect(scaleDown).to.be.null;
            });
            it('should scale based on queueSize equals 1', async () => {
                const scale = async (data) => {
                    streamService.reportStats(data);
                }
                const list = [{
                    nodeName: 'D',
                    queueSize: 1
                }];
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(1);
            });
            it('should not scale if currentSize is fixed', async () => {
                const scale = async (data) => {
                    streamService.reportStats(data);
                    await delay(100);
                }
                const currentSize = async (data) => {
                    data[0].currentSize = 10;
                    data[0].queueSize += 500
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName: 'D',
                    queueSize: 500
                }];

                await scale(list);
                const jobs1 = autoScale();
                const jobs2 = autoScale();
                const jobs3 = autoScale();
                await currentSize(list);
                const jobs4 = autoScale();
                const jobs5 = autoScale();
                expect(jobs1.scaleUp.replicas).to.eql(1);
                expect(jobs1.scaleDown).to.be.null;
                expect(jobs2.scaleUp).to.be.null;
                expect(jobs2.scaleDown).to.be.null;
                expect(jobs3.scaleUp).to.be.null;
                expect(jobs3.scaleDown).to.be.null;
                expect(jobs4.scaleUp.replicas).to.eql(10);
                expect(jobs4.scaleDown).to.be.null;
                expect(jobs5.scaleUp).to.be.null;
                expect(jobs5.scaleDown).to.be.null;
            });
            it('should scale based on queueSize only', async () => {
                const scale = async (data) => {
                    streamService.reportStats(data);
                }
                const list = [{
                    nodeName: 'D',
                    queueSize: 500,
                    responses: 0
                }];
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(1);
            });
            it('should scale based on queueSize and responses only', async () => {
                const scale = async (data) => {
                    streamService.reportStats(data);
                }
                const list = [{
                    nodeName: 'D',
                    queueSize: 500,
                    responses: 100
                }];
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(5);
            });
            it('should scale up based on high req/res rate', async () => {
                const nodeName = 'D';
                const requests = async (data) => {
                    data[0].currentSize = 5;
                    data[0].queueSize += 100;
                    data[0].responses = 100;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    sent: 0,
                    queueSize: 0,
                    responses: 0
                }];
                await requests(list);
                await requests(list);
                await requests(list);
                const jobs = autoScale();
                expect(jobs.scaleUp.replicas).to.eql(5);
                expect(jobs.scaleDown).to.be.null;
            });
            it('should scale based on request rate', async () => {
                const scale = async (data) => {
                    data[0].sent += 10;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName: 'D',
                    sent: 10,
                    queueSize: 0
                }];
                await scale(list);
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(1);
            });
            it('should scale based on durations', async () => {
                const scale = async (data) => {
                    data[0].sent += 100;
                    data[0].responses += 30;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName: 'D',
                    sent: 0,
                    responses: 0,
                    durations: [2.34, 3.56, 4.88, 5.12, 2.56, 3.57, 4.59, 1.57, 2.81, 4.23]
                }];
                await scale(list);
                await scale(list);
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp.replicas).to.eql(4);
                expect(scaleDown).to.be.null;
            });
            it('should scale based on durations', async () => {
                const scale = async (data) => {
                    data[0].sent += 100;
                    data[0].responses += 0;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName: 'D',
                    sent: 0,
                    responses: 0,
                    durations: [0.3, 0.2, 0.8, 0.7, 0.01, 0.1, 0.6, 0.2, 0.1]
                }];
                await scale(list);
                await scale(list);
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(1);
            });
            it('should scale only up based on req/res rate', async () => {
                const scale = async (data) => {
                    data[0].sent += 10;
                    data[0].responses += 3;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const increaseSize = (data) => {
                    data[0].responses += 1;
                    data[0].currentSize += 2;
                    streamService.reportStats(data);
                }
                const list = [{
                    nodeName: 'D',
                    sent: 10,
                    queueSize: 0,
                    currentSize: 0,
                    responses: 3
                }];
                await scale(list);
                await scale(list);
                const jobs1 = autoScale();
                increaseSize(list);
                const jobs2 = autoScale();
                increaseSize(list);
                autoScale();
                const jobs3 = autoScale();
                await scale(list);
                await scale(list);
                const jobs4 = autoScale();
                const jobs5 = autoScale();
                const jobs6 = autoScale();
                expect(jobs1.scaleUp.replicas).to.eql(4);
                expect(jobs2.scaleUp).to.be.null;
                expect(jobs3.scaleUp).to.be.null;
                expect(jobs4.scaleUp).to.be.null;
                expect(jobs5.scaleUp).to.be.null;
                expect(jobs6.scaleUp).to.be.null;
                expect(jobs1.scaleDown).to.be.null;
                expect(jobs2.scaleDown).to.be.null;
                expect(jobs3.scaleDown).to.be.null;
                expect(jobs4.scaleDown).to.be.null;
                expect(jobs5.scaleDown).to.be.null;
                expect(jobs6.scaleDown).to.be.null;
            });
        });
        describe('scale-down', () => {
            it('should scale up and down based durations', async () => {
                const nodeName = 'D';
                const requestsUp = async (data) => {
                    data[0].queueSize += 100;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const responsesUp = async (data) => {
                    data[0].responses += 100;
                    data[0].sent = 200;
                    data[0].queueSize = 0;
                    data[0].currentSize += 1;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    currentSize: 1,
                    sent: 0,
                    queueSize: 0,
                    responses: 0,
                    durations: [0.3, 0.2, 0.8, 0.7, 0.01, 0.1, 0.6, 0.2, 0.1]
                }];
                await requestsUp(list);
                await requestsUp(list);
                const jobs1 = autoScale();
                const jobs2 = autoScale();
                await responsesUp(list);
                await responsesUp(list);
                const jobs3 = autoScale();
                const jobs4 = autoScale();
                expect(jobs1.scaleUp.replicas).to.eql(1);
                expect(jobs2.scaleUp).to.be.null;
                expect(jobs2.scaleUp).to.be.null;
                expect(jobs3.scaleUp).to.be.null;
                expect(jobs3.scaleDown.replicas).to.eql(1);
                expect(jobs4.scaleUp).to.be.null;
                expect(jobs4.scaleDown).to.be.null;
            });
            it('should not scale down based on responses', async () => {
                const nodeName = 'D';
                const requests = async (data) => {
                    data[0].currentSize = 5;
                    data[0].responses += 100;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    responses: 0
                }];
                await requests(list);
                await requests(list);
                await requests(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp).to.be.null;
                expect(scaleDown).to.be.null;
            });
            it('should not scale down based on currentSize', async () => {
                const nodeName = 'D';
                const requests = async (data) => {
                    data[0].currentSize = 1;
                    data[0].queueSize = 0;
                    data[0].responses += 100;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    sent: 0,
                    queueSize: 0,
                    responses: 0
                }];
                await requests(list);
                await requests(list);
                await requests(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp).to.be.null;
                expect(scaleDown).to.be.null;
            });
            it('should not scale up and down based on zero ratio', async () => {
                const jobId = uid();
                const nodeName = 'D';
                const requests = async (data) => {
                    data[0].currentSize = 5;
                    data[0].queueSize = 100;
                    data[0].responses = 100;
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    sent: 0,
                    queueSize: 0,
                    responses: 0
                }];
                await requests(list);
                await requests(list);
                await requests(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp).to.be.null;
                expect(scaleDown).to.be.null;
            });
        });
        describe('no-scale', () => {
            it('should not scale when no relevant data', async () => {
                const scale = async (data) => {
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName: 'D'
                }];
                await scale(list);
                await scale(list);
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                expect(scaleUp).to.be.null;
                expect(scaleDown).to.be.null;
            });
            it('should not over the maxSizeWindow', async () => {
                const nodeName = 'D';
                const data = [{
                    nodeName,
                    queueSize: 10,
                    durations: [2.34, 3.56, 4.88, 5.12, 2.56, 3.57, 4.59, 1.57, 2.81, 4.23]
                }];
                streamService.reportStats(data);
                streamService.reportStats(data);
                streamService.reportStats(data);
                streamService.reportStats(data);
                streamService.reportStats(data);
                streamService.reportStats(data);
                const masters = streamService._adapters._getMasters();
                const stats = masters[0]._autoScaler._statistics._data[nodeName]['C'];
                const { requests, responses, durations } = stats;
                const maxSizeWindow = testParams.config.streaming.autoScaler.maxSizeWindow;
                expect(requests.items).to.have.lengthOf(maxSizeWindow);
                expect(responses.items).to.have.lengthOf(maxSizeWindow);
                expect(durations.items).to.have.lengthOf(maxSizeWindow);
            });
        });
        describe('progress', () => {
            it('should scale and update progress', async () => {
                const nodeName = 'D';
                const scale = async (data) => {
                    streamService.reportStats(data);
                    await delay(100);
                }
                const list = [{
                    nodeName,
                    queueSize: 5,
                    responses: 4
                }];
                await scale(list);
                const { scaleUp, scaleDown } = autoScale();
                const progressMap = checkProgress();
                expect(progressMap['C']).to.eql(0.8);
                expect(scaleDown).to.be.null;
                expect(scaleUp.replicas).to.eql(2);
            });
        });
    });
    describe('master-slaves', () => {
        it('should scale up based on avg master and slaves', async () => {
            const nodeName = 'D';
            const requests = async (data) => {
                streamService.reportStats(data);
            }
            const currentSize = 2;
            const list = [{ nodeName, queueSize: 150, responses: 30, currentSize }];
            const list1 = { nodeName, queueSize: 300, responses: 80, currentSize };
            const list2 = { nodeName, queueSize: 450, responses: 140, currentSize };
            const slave1 = new SlaveAdapter({ jobId, nodeName, source: 'A' });
            const slave2 = new SlaveAdapter({ jobId, nodeName, source: 'B' });
            await requests(list);
            await slave1.report(list1);
            await slave2.report(list2);
            await delay(500);

            const { scaleUp, scaleDown } = autoScale();
            const progress = checkProgress();
            const total = scaleUp.nodes.reduce((acc, c) => acc + c, 0);
            const avg = total / scaleUp.nodes.length;
            expect(Object.keys(progress).sort()).to.deep.equal(['A', 'B', 'C'])
            expect(Object.values(progress).sort()).to.deep.equal([0.2, 0.27, 0.31])
            expect(scaleUp.currentSize).to.eql(currentSize);
            expect(scaleUp.nodes).to.have.lengthOf(3);
            expect(scaleUp.replicas).to.eql(avg);
            expect(scaleUp.scaleTo).to.eql(scaleUp.replicas + currentSize);
            expect(scaleDown).to.be.null;
        });
        it('should start and finish correctly', async () => {
            await streamService.start(job);
            expect(streamService._options).to.be.not.null;
            expect(streamService._jobData).to.be.not.null;
            expect(streamService._election).to.be.not.null;
            expect(streamService._adapters).to.be.not.null;
            expect(streamService._progress).to.be.not.null;
            expect(streamService._scalerService).to.be.not.null;
            expect(streamService._active).to.eql(true);
            await streamService.finish(job);
            expect(streamService._options).to.be.null;
            expect(streamService._jobData).to.be.null;
            expect(streamService._election).to.be.null;
            expect(streamService._adapters).to.be.null;
            expect(streamService._progress).to.be.null;
            expect(streamService._scalerService).to.be.null;
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
            expect(changes1).to.be.null;
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
