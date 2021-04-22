const { nodeKind } = require('@hkube/consts');

module.exports = {
    name: nodeKind.Gateway,
    algorithmImage: 'hkube/algorithm-gateway',
    cpu: 0.5,
    mem: '512Mi'
};
