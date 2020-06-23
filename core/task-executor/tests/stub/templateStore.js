module.exports = [
    {
        name: 'eval-alg',
        algorithmImage: 'hkube/algorunner',
        cpu: 0.5,
        mem: '256Mi'
    },
    {
        name: 'green-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 7,
        mem: '512Mi'
    },
    {
        name: 'yellow-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    },
    {
        name: 'black-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    },
    {
        name: 'max-cpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 25,
        mem: '128Mi'
    },
    {
        name: 'max-mem',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '50Gi'
    },
    {
        name: 'max-gpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 10
    },
    {
        name: 'big-cpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 8,
        mem: '128Mi'
    },
    {
        name: 'big-mem',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '37Gi'
    },
    {
        name: 'big-gpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 6
    },
    {
        name: 'node-selector',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        nodeSelector: {
            type: 'cpu-extreme'
        }
    },
    {
        name: 'node-all-params',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 100,
        mem: '50Gi',
        gpu: 100,
        nodeSelector: {
            type: 'gpu-extreme',
            max: 'bound'
        }
    }
];
