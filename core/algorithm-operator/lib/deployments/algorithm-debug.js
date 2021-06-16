const { debugService, debugIngress, } = require('../templates/algorithm-debug');

const createIngressServiceSpec = ({ algorithmName, clusterOptions }) => {
    const debugName = algorithmName.substr(0, algorithmName.lastIndexOf('-debug'));
    const ingressSpec = debugIngress({ algorithmName, debugName }, clusterOptions);
    const serviceSpec = debugService({ algorithmName, debugName });
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
