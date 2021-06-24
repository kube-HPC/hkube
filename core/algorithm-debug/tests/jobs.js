const { uuid } = require('@hkube/uid');
const jobData = {
    jobId: uuid(),
    taskId: uuid(),
    input: [],
    kind: 'stream',
    stateType: 'stateless',
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

const jobDataStateful = {
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
const jobDataBatch = {
    jobId: uuid(),
    taskId: uuid(),
    input: [],
    kind: 'batch',
    nodeName: 'A'
}
module.exports = { jobData, jobDataBatch, jobDataStateful }