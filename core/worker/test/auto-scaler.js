const delay = require('delay');
const { expect } = require('chai');
const sinon = require('sinon');
const stateAdapter = require('../lib/states/stateAdapter');
const autoScaler = require('../lib/streaming/auto-scaler.js');

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


describe.only('auto-scaler', () => {
    it('should set inititial state to bootstrap', async () => {
        const data = [
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
        await autoScaler.init(pipeline);
        autoScaler.report(data);
        autoScaler._checkBackPressure();
    });
});
