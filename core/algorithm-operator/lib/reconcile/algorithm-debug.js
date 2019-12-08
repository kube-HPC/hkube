const log = require('@hkube/logger').GetLogFromContainer();
const etcd = require('../helpers/etcd');
const { createKindsSpec } = require('../deployments/worker-debug');
const kubernetes = require('../helpers/kubernetes');
const component = require('../consts/componentNames').ALGORITHM_DEBUG_RECONCILER;
const debugPathPrefix = 'hkube/debug';

const _createKinds = async (jobDetails) => {
    const { deploymentSpec, ingressSpec, serviceSpec } = createKindsSpec(jobDetails);
    const deploymentCreateResult = await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.algorithmName }, 'worker');
    return deploymentCreateResult;
};

const reconcile = async ({ kubernetesKinds, algorithms, versions, registry, clusterOptions, options } = {}) => {
    const deployments = kubernetesKinds.resDeployment.body.items.map(r => ({
        name: r.metadata.labels['algorithm-name']
    }));
    const added = algorithms.filter(a => !deployments.find(d => d.name === a.name));
    const removed = deployments.filter(d => !algorithms.find(a => d.name === a.name));

    const reconcileResult = {};

    if (added.length > 0 || removed.length > 0) {
        log.info(`added:\n ${JSON.stringify(added, null, 2)}\nremoved:\n${JSON.stringify(removed, null, 2)}`, { component });
    }
    else {
        log.debug(`added:\n ${JSON.stringify(added, null, 2)}\nremoved:\n${JSON.stringify(removed, null, 2)}`, { component });
    }
    for (let algorithm of added) { // eslint-disable-line
        await _createKinds({ algorithmName: algorithm.name, versions, registry, clusterOptions, options, workerEnv: algorithm.workerEnv }); // eslint-disable-line
        await etcd.storeAlgorithmData(algorithm.name, { algorithmData: algorithm, path: `${debugPathPrefix}/${algorithm.name}` }); // eslint-disable-line
    }
    for (let algorithm of removed) { // eslint-disable-line
        await etcd.removeAlgorithmData(algorithm.name); // eslint-disable-line
        await kubernetes.deleteExpoesedJob(algorithm.name, 'worker'); // eslint-disable-line
    }

    return reconcileResult;
};

module.exports = {
    reconcile
};
