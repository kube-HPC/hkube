const delay = require('delay');
const { expect } = require('chai');
const sinon = require('sinon');
const stateAdapter = require('../lib/states/stateAdapter');
const autoScaler = require('../lib/auto-scale/auto-scaler.js');

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
            { nodeName: 'two', duration: 150, currentSize: 0, queueSize: 1 },
            // { nodeName: 'three', duration: 3000, currentSize: 0, queueSize: 250 }
        ];
        await stateAdapter._etcd.executions.running.set(pipeline);
        await autoScaler.init(pipeline);
        autoScaler.report(data);
        autoScaler._checkBackPressure();
    });
});
