// This test suite was written as a 2nd part to 'streaming.js' test suite, due to conflicts between different tests

const { expect } = require('chai');
const { uid } = require('@hkube/uid');
const stateAdapter = require('../lib/states/stateAdapter');
const streamHandler = require('../lib/streaming/services/stream-handler');

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
        { source: "C", target: "F" },
        { source: "E", target: "F" },
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

const jobId = uid();
const jobId2 = uid();
const jobId3 = uid();

const createJobMinStateless = (jobId) => {
    const job = {
        jobId,
        kind: 'stream',
        taskId: uid(),
        nodeName: 'F',
        algorithmName: 'my-alg',
        pipelineName: 'my-pipe',
        parents: [],
        childs: ['D','F'],
    };
    return job;
};
const createJobNoMinStateless = (jobId) => {
    const job = {
        jobId,
        kind: 'stream',
        taskId: uid(),
        nodeName: 'E',
        algorithmName: 'my-alg',
        pipelineName: 'my-pipe',
        parents: [],
        childs: ['D','F'],
    };
    return job;
};

const createJobNoProperty = (jobId) => {
    const job = {
        jobId,
        kind: 'stream',
        taskId: uid(),
        nodeName: 'D',
        algorithmName: 'my-alg',
        pipelineName: 'my-pipe',
        parents: [],
        childs: ['D','F'],
    };
    return job;
};

const jobMinStateless = createJobMinStateless(jobId);
const jobNoMinStateless = createJobNoMinStateless(jobId2);
const jobNoProp = createJobNoProperty(jobId3);

describe('Streaming scaling due to parent existance', () => {
    before(async () => {
        await stateAdapter._db.jobs.create({ pipeline, jobId });
        await stateAdapter._db.jobs.create({ pipeline, jobId: jobId2 });
        await stateAdapter._db.jobs.create({ pipeline, jobId: jobId3 });
    });
    it('should prevent scaledown due to parent - and has minStateless > 0', async () => {
        await streamHandler.start(jobMinStateless);
        expect(streamHandler._isMinStateless).to.eql(true);
    });
    it('should prevent scaledown due to parent - and has minStateless is 0', async () => {
        await streamHandler.start(jobNoMinStateless);
        expect(streamHandler._isMinStateless).to.eql(false);
    });
    it('should prevent scaledown due to parent - and has no minStateless prop', async () => {
        await streamHandler.start(jobNoProp);
        expect(streamHandler._isMinStateless).to.eql(false);
    });

});