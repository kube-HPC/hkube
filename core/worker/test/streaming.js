const delay = require('delay');
const { expect } = require('chai');
const sinon = require('sinon');
const { uuid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const autoScaler = require('../lib/streaming/auto-scaler.js');
const discovery = require('../lib/streaming/discovery.js');

const pipeline = {
    "jobId": 'k123h1jk2h',
    "name": "stream",
    "kind": "stream",
    "nodes": [
        {
            "nodeName": "one",
            "algorithmName": "eval-alg",
            "input": [
                "@flowInput.arraySize",
                "@flowInput.bufferSize"
            ],
            "stateType": "stateful"
        },
        {
            "nodeName": "two",
            "algorithmName": "eval-alg",
            "input": [
                "@one"
            ],
            "stateType": "stateless"
        },
        {
            "nodeName": "three",
            "algorithmName": "eval-alg",
            "input": [
                "@one"
            ],
            "stateType": "stateless"
        }
    ],
    "flowInput": {
        "arraySize": 1,
        "bufferSize": 50
    }
}

const streamingDiscovery = {
    host: process.env.POD_IP || '127.0.0.1',
    port: process.env.STREAMING_DISCOVERY_PORT || 9021
};

describe('Streaming', () => {
    describe('auto-scaler', () => {
        it('should check backPressure', async () => {
            const scale = (data) => {
                data[0].sent += 100;
                data[1].sent += 100;
            }
            const list = [
                {
                    nodeName: 'one',
                    durations: [2000, 3500, 1212, 4354],
                    sent: 100,
                    queueSize: 5
                },
                {
                    nodeName: 'two',
                    durations: [1000, 3300, 2313, 4354],
                    sent: 200,
                    queueSize: 17
                }];
            await stateAdapter._etcd.executions.running.set(pipeline);
            await autoScaler.start(pipeline);
            autoScaler.report(list);
            scale(list);
            await delay(1000);
            autoScaler.report(list);
            scale(list);
            await delay(1000);
            autoScaler.report(list);
            autoScaler._checkBackPressure();
        });
    });
    describe('discovery', () => {
        before(async () => {
            const config = testParams.config;
            const jobId = uuid();
            stateAdapter._etcd.discovery._client.leaser._lease = null;
            await stateAdapter._etcd.discovery.register({ data: { jobId, taskId: uuid(), nodeName: 'A', streamingDiscovery }, instanceId: uuid() });
            stateAdapter._etcd.discovery._client.leaser._lease = null;
            await stateAdapter._etcd.discovery.register({ data: { jobId, taskId: uuid(), nodeName: 'B', streamingDiscovery }, instanceId: uuid() });
            stateAdapter._etcd.discovery._client.leaser._lease = null;
            await stateAdapter._etcd.discovery.register({ data: { jobId, taskId: uuid(), nodeName: 'C', streamingDiscovery }, instanceId: uuid() });
            await discovery.start({ jobId, taskId: uuid() });
        });
        it('should set inititial state to bootstrap', async () => {
            const count1 = discovery.countInstances('A');
            const count2 = discovery.countInstances('B');
            const count3 = discovery.countInstances('C');
            expect(count1).to.eql(1);
            expect(count2).to.eql(1);
            expect(count3).to.eql(1);
        });
        it('should set inititial state to bootstrap', async () => {
            const addresses = discovery.getAddresses(['A', 'B', 'C']);
            expect(addresses).to.have.lengthOf(3)
        });
    });
});
