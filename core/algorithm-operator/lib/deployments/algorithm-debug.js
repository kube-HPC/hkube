const { debugService, debugIngress, } = require('../templates/algorithm-debug');

const createIngressServiceSpec = ({ algorithmName, clusterOptions }) => {
    const ingressSpec = debugIngress({ algorithmName }, clusterOptions);
    const serviceSpec = debugService({ algorithmName });
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
