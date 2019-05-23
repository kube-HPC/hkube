const discoveryStub = [
    {
        workerId: '111',
        algorithmName: 'black-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    {
        workerId: '222',
        algorithmName: 'green-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    {
        workerId: '333',
        algorithmName: 'yellow-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    {
        workerId: '444',
        algorithmName: 'eval-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    {
        workerId: '555',
        algorithmName: 'yellow-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    {
        workerId: '666',
        algorithmName: 'green-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    }
];

const templateStoreStub = [
    {
        name: 'algo1',
        workerImage: 'worker1:latest',
        algorithmImage: 'algo1:v1.1'
    },
    {
        name: 'algo2',
        workerImage: 'worker2:latest',
        algorithmImage: 'algo2:v1.2'
    }
];

module.exports = {
    discoveryStub,
    templateStoreStub
};
