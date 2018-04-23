const templateStore = {
    'eval-alg': {
        algorithmImage: 'hkube/algorunner'
    },
    'green-alg': {
        algorithmImage: 'hkube/algorithm-example'
    },
    'yellow-alg': {
        algorithmImage: 'hkube/algorithm-example'
    },
    'black-alg': {
        algorithmImage: 'hkube/algorithm-example'
    }
};

const getAlgorithmTemplate = ({ algorithmName }) => {
    return templateStore[algorithmName];
};

module.exports = {
    getAlgorithmTemplate
};
