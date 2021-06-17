const { debugService, debugIngress, } = require('../templates/algorithm-debug');

const createIngressServiceSpec = ({ algorithmName, debugName, clusterOptions }) => {
    const ingressSpec = debugIngress({ algorithmName, debugName }, clusterOptions);
    const serviceSpec = debugService({ algorithmName, debugName });
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
