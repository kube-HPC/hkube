const discoveryStub = {
    '/discovery/stub/111': {
        algorithmName: 'black-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    '/discovery/stub/222': {
        algorithmName: 'green-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    '/discovery/stub/333': {
        algorithmName: 'yellow-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    '/discovery/stub/444': {
        algorithmName: 'eval-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    '/discovery/stub/555': {
        algorithmName: 'yellow-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    },
    '/discovery/stub/666': {
        algorithmName: 'green-alg',
        workerStatus: 'ready',
        jobStatus: 'ready',
        error: null
    }
};

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
