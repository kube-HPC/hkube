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
    }
];
