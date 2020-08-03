const delay = require('delay');
const { expect } = require('chai');
const { uuid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const autoScaler = require('../lib/streaming/auto-scaler.js');
const discovery = require('../lib/streaming/discovery.js');

const jobId = uuid();
const pipeline1 = {
    jobId,
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
                "@one"
            ],
            stateType: "stateless"
        },
        {
            nodeName: "C",
            algorithmName: "eval-alg",
            input: [
                "@one"
            ],
            stateType: "stateless"
        }
    ],
    flowInput: {
        "arraySize": 1,
        "bufferSize": 50
    }
}

const pipeline2 = {
    jobId,
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
            nodeName: "D",
            algorithmName: "eval-alg",
            input: [
                "@one"
            ],
            stateType: "stateless"
        },
        {
            nodeName: "E",
            algorithmName: "eval-alg",
            input: [
                "@one"
            ],
            stateType: "stateless"
        }
    ],
    flowInput: {
        "arraySize": 1,
        "bufferSize": 50
    }
}

const streamingDiscovery = {
    host: process.env.POD_IP || '127.0.0.1',
    port: process.env.STREAMING_DISCOVERY_PORT || 9021
};

const addDiscovery = async (nodeName) => {
    stateAdapter._etcd.discovery._client.leaser._lease = null;
    await stateAdapter._etcd.discovery.register({ data: { jobId, taskId: uuid(), nodeName, streamingDiscovery }, instanceId: uuid() });
}

describe.only('Streaming', () => {
    describe('auto-scaler', () => {
        it('should not scale when no relevant data', async () => {
            const scale = async (data) => {
                autoScaler.report(data);
                await delay(300);
            }
            const list = [{
                nodeName: 'D'
            }];
            await stateAdapter._etcd.executions.running.set(pipeline2);
            await autoScaler.start({ jobId, taskId: uuid() });
            await scale(list);
            await scale(list);
            await scale(list);
            const jobs = autoScaler.autoScale();
            expect(jobs).to.have.lengthOf(0);
        });
        it('should scale based on queueSize only', async () => {
            const scale = async (data) => {
                autoScaler.report(data);
                await delay(300);
            }
            const list = [{
                nodeName: 'D',
                queueSize: 5
            }];
            await stateAdapter._etcd.executions.running.set(pipeline2);
            await autoScaler.start({ jobId, taskId: uuid() });
            await scale(list);
            const jobs = autoScaler.autoScale();
            expect(jobs).to.have.lengthOf(1);
            expect(jobs[0].replicas).to.eql(3);
        });
        it('should scale max size based on queueSize only', async () => {
            const scale = async (data) => {
                data[0].queueSize += 10;
                autoScaler.report(data);
                await delay(300);
            }
            const list = [{
                nodeName: 'D',
                queueSize: 5
            }];
            await stateAdapter._etcd.executions.running.set(pipeline2);
            await autoScaler.start({ jobId, taskId: uuid() });
            await scale(list);
            await scale(list);
            await scale(list);
            const jobs = autoScaler.autoScale();
            expect(jobs).to.have.lengthOf(1);
            expect(jobs[0].replicas).to.eql(10);
        });
        it.only('should scale based on sent only', async () => {
            const scale = async (data) => {
                data[0].sent += 100;
                autoScaler.report(data);
                await delay(300);
            }
            const list = [{
                nodeName: 'D',
                sent: 20
            }];
            await stateAdapter._etcd.executions.running.set(pipeline2);
            await autoScaler.start({ jobId, taskId: uuid() });
            await scale(list);
            await scale(list);
            const jobs = autoScaler.autoScale();
        });
        it('should check backPressure', async () => {
            const scale = async (data) => {
                data[0].sent += 100;
                data[1].sent += 100;
                data[0].queueSize += 10;
                data[1].queueSize += 10;
                data[0].requests += 40;
                data[1].requests += 40;
                autoScaler.report(data);
                await delay(300);
            }
            const list = [{
                nodeName: 'B',
                durations: [2000, 3500, 1212, 4354],
                sent: 100,
                queueSize: 10,
                requests: 20
            },
            {
                nodeName: 'C',
                durations: [1000, 3300, 2313, 4354],
                sent: 200,
                queueSize: 150,
                requests: 300
            }];

            await stateAdapter._etcd.executions.running.set(pipeline1);
            await autoScaler.start({ jobId, taskId: uuid() });
            await scale(list);
            await scale(list);
            await scale(list);
            await scale(list);
            autoScaler.autoScale();
        });
    });
    describe.skip('discovery', () => {
        it('should set', async () => {
            await addDiscovery('B');
            await addDiscovery('B');
            await addDiscovery('C');
            await addDiscovery('C');
            const count1 = discovery.countInstances('B');
            const count2 = discovery.countInstances('C');
            expect(count1).to.eql(2);
            expect(count2).to.eql(2);
        });
        it('should set', async () => {
            const addresses = discovery.getAddresses(['B', 'C']);
            expect(addresses).to.have.lengthOf(3)
        });
    });
});
