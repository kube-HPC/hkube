const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createDeploymentSpec } = require('../deployments/deploymentCreator');
const kubernetes = require('../helpers/kubernetes');
const component = require('../../common/consts/componentNames').RECONCILER;
const { normalizeDeployments, normalizeAlgorithms } = require('./normalize');


const _createDeployment = async (algorithmName, options) => {
    log.debug(`need to add ${algorithmName} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ algorithmName, ...options });
    const deploymentCreateResult = await kubernetes.createDeployment({ spec });
    return deploymentCreateResult;
};


const reconcile = async ({ deployments, algorithms, versions } = {}) => {
    const normDeployments = normalizeDeployments(deployments);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const added = normAlgorithms.filter(a => !normDeployments.find(d => d.algorithmName === a.name));
    const removed = normDeployments.filter(d => !normAlgorithms.find(a => d.algorithmName === a.name));
    log.debug(`added:\n ${JSON.stringify(added, null, 2)}\nremoved:\n${JSON.stringify(removed, null, 2)}`);
    const createPromises = [];
    const reconcileResult = {};
    for (let algorithm of added) { // eslint-disable-line
        createPromises.push(_createDeployment(algorithm.name, { versions }));
    }
    for (let algorithm of removed) { // eslint-disable-line
        createPromises.push(kubernetes.deleteDeployment(algorithm.name));
    }
    await Promise.all(createPromises);
    return reconcileResult;
};

module.exports = {
    reconcile,
};
