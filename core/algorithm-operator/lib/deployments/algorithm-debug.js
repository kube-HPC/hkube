const { debugService, debugIngress, } = require('../templates/algorithm-debug');

const createIngressServiceSpec = ({ algorithmName, clusterOptions }) => {
    const originalAlgorithmName = algorithmName.substr(0, algorithmName.lastIndexOf('-debug'));
    const ingressSpec = debugIngress({ algorithmName: originalAlgorithmName }, clusterOptions);
    const serviceSpec = debugService({ algorithmName: originalAlgorithmName });
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
