const { gatewayService, gatewayIngress, } = require('../templates/algorithm-gateway');

const createIngressServiceSpec = ({ algorithmName, clusterOptions }) => {
    const ingressSpec = gatewayIngress(algorithmName, clusterOptions);
    const serviceSpec = gatewayService(algorithmName);
    return { ingressSpec, serviceSpec };
};

module.exports = {
    createIngressServiceSpec
};
