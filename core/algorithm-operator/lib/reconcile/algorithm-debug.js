const { createIngressServiceSpec } = require('../deployments/algorithm-debug');
const kubernetes = require('../helpers/kubernetes');
const { normalizeServices } = require('./normalize');

const _createIngressService = async ({ algorithmName, clusterOptions }) => {
    const { ingressSpec, serviceSpec } = createIngressServiceSpec({ algorithmName, clusterOptions });
    await kubernetes.createDebugServiceIngress({ ingressSpec, serviceSpec, algorithmName });
};

const reconcile = async ({ services, debugAlgorithms, clusterOptions } = {}) => {
    const normServices = normalizeServices(services);
    const added = debugAlgorithms.filter(a => !normServices.find(d => d.algorithmName === a.name));
    const removed = normServices.filter(d => !debugAlgorithms.find(a => d.algorithmName === a.name));
    const reconcileResult = {};

    for (let debug of added) { // eslint-disable-line
        await _createIngressService({ algorithmName: debug.name, clusterOptions }); // eslint-disable-line
    }
    for (let debug of removed) { // eslint-disable-line
        await kubernetes.deleteDebugServiceIngress({ algorithmName: debug.algorithmName }); // eslint-disable-line
    }
    return reconcileResult;
};

module.exports = {
    reconcile
};
