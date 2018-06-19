const templateStore = {
    'eval-alg': {
        algorithmImage: 'hkube/algorunner',
        cpu: 0.5,
        mem: '256Mi'
    },
    'green-alg': {
        algorithmImage: 'hkube/algorithm-example',
        cpu: 7,
        mem: '512Mi'
    },
    'yellow-alg': {
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    },
    'black-alg': {
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    }
};


module.exports = {
    templateStore
};
