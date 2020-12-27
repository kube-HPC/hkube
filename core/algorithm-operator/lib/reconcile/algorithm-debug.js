const log = require('@hkube/logger').GetLogFromContainer();
const isEqualWith = require('lodash.isequalwith');
const objectPath = require('object-path');
const { createKindsSpec } = require('../deployments/worker-debug');
const kubernetes = require('../helpers/kubernetes');
const component = require('../consts/componentNames').ALGORITHM_DEBUG_RECONCILER;
const deploymentType = require('../consts/DeploymentTypes').WORKER;
const { normalizeDeployments } = require('./normalize');

const _createKinds = async (jobDetails) => {
    const { deploymentSpec, ingressSpec, serviceSpec } = createKindsSpec(jobDetails);
    const deploymentCreateResult = await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.algorithmName }, deploymentType);
    return deploymentCreateResult;
};

const _updateDeployment = async (jobDetails) => {
    const { deploymentSpec, ingressSpec, serviceSpec } = createKindsSpec(jobDetails);
    const deploymentCreateResult = await kubernetes.updateExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.algorithmName }, deploymentType);
    return deploymentCreateResult;
};

const _filterChangedDeployments = (deployment, algorithms, versions, registry, clusterOptions, options) => {
    const algorithm = algorithms.find(a => a.name === deployment.algorithmName);
    if (!algorithm) {
        return false;
    }
    const { deploymentSpec } = createKindsSpec({ algorithmName: algorithm.name, versions, registry, clusterOptions, options, workerEnv: algorithm.workerEnv });
    const imageChanged = deploymentSpec.spec.template.spec.containers[0].image !== deployment.imageFull;

    const customizer = (a, b) => objectPath.get(a, 'valueFrom.fieldRef') || objectPath.get(b, 'valueFrom.fieldRef');
    const envChanged = !isEqualWith(deploymentSpec.spec.template.spec.containers[0].env, deployment.env, customizer);
    return imageChanged || envChanged;
};

const reconcile = async ({ kubernetesKinds, algorithms, versions, registry, clusterOptions, options } = {}) => {
    const deployments = normalizeDeployments(kubernetesKinds.resDeployment);
    const added = algorithms.filter(a => !deployments.find(d => d.algorithmName === a.name));
    const removed = deployments.filter(d => !algorithms.find(a => d.algorithmName === a.name));
    const updated = deployments.filter(d => _filterChangedDeployments(d, algorithms, versions, registry, clusterOptions, options));
    const reconcileResult = {};

    if (added.length > 0 || removed.length > 0 || updated.length > 0) {
        log.info(`added: ${added.map(a => a.name)}\nremoved: ${removed.map(r => r.name)}\nupdated: ${updated.map(u => u.algorithmName)}`, { component });
    }
    else {
        log.debug(`added:\n ${JSON.stringify(added, null, 2)}\nremoved:\n${JSON.stringify(removed, null, 2)}`, { component });
    }
    for (let algorithm of added) { // eslint-disable-line
        await _createKinds({ algorithmName: algorithm.name, versions, registry, clusterOptions, options, workerEnv: algorithm.workerEnv }); // eslint-disable-line
    }
    for (let algorithm of removed) { // eslint-disable-line
        await kubernetes.deleteExposedDeployment(algorithm.algorithmName, deploymentType); // eslint-disable-line
    }
    for (let deployment of updated) { // eslint-disable-line
        const algorithm = algorithms.find(a => a.name === deployment.algorithmName);
        if (algorithm) {
            await _updateDeployment({ algorithmName: algorithm.name, versions, registry, clusterOptions, options, workerEnv: algorithm.workerEnv }); // eslint-disable-line
        }
    }

    return reconcileResult;
};

module.exports = {
    reconcile
};
