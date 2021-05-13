const { createIngressServiceSpec } = require('../deployments/algorithm-gateway');
const kubernetes = require('../helpers/kubernetes');
const { normalizeServices } = require('./normalize');

const _createIngressService = async ({ algorithmName, gatewayName, clusterOptions }) => {
    const { ingressSpec, serviceSpec } = createIngressServiceSpec({ algorithmName, gatewayName, clusterOptions });
    await kubernetes.createGatewayServiceIngress({ ingressSpec, serviceSpec, algorithmName });
};

const reconcile = async ({ services, gateways, clusterOptions } = {}) => {
    const normServices = normalizeServices(services);
    const added = gateways.filter(a => !normServices.find(d => d.algorithmName === a.name));
    const removed = normServices.filter(d => !gateways.find(a => d.algorithmName === a.name));
    const reconcileResult = {};

    for (let gateway of added) { // eslint-disable-line
        await _createIngressService({ algorithmName: gateway.name, gatewayName: gateway.gatewayName, clusterOptions }); // eslint-disable-line
    }
    for (let gateway of removed) { // eslint-disable-line
        await kubernetes.deleteGatewayServiceIngress({ algorithmName: gateway.algorithmName }); // eslint-disable-line
    }
    return reconcileResult;
};

module.exports = {
    reconcile
};
