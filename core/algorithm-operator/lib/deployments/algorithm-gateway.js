const { gatewayService, gatewayIngress, } = require('../templates/algorithm-gateway');

const createIngressServiceSpec = ({ algorithmName, gatewayName, clusterOptions }) => {
    const ingressSpec = gatewayIngress({ algorithmName, gatewayName }, clusterOptions);
    const serviceSpec = gatewayService({ algorithmName, gatewayName });
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
