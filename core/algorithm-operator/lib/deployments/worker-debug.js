const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyStorage, applyImagePullSecret, applyVolumeMounts, applyVolumes } = require('@hkube/kubernetes-client').utils;
const { applyImage, applyJaeger } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { deploymentDebugTemplate, workerIngress, workerService } = require('../templates/worker-debug');
const CONTAINERS = require('../consts/containers');

const applyAlgorithmName = (inputSpec, algorithmName, containerName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['algorithm-name'] = algorithmName;
    return applyEnvToContainer(spec, containerName, { ALGORITHM_TYPE: algorithmName });
};

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const applyDataSourcesVolumes = (inputSpec) => {
    let spec = clonedeep(inputSpec);
    // if (!clusterOptions.dataSourcesEnabled) {
    //     return spec;
    // }
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM_DEBUG, {
        name: 'datasources-storage',
        mountPath: '/hkube/datasources-storage'
    });
    spec = applyVolumes(spec, {
        name: 'datasources-storage',
        persistentVolumeClaim: {
            claimName: 'hkube-datasources'
        }
    });
    return spec;
};

const createKindsSpec = ({ algorithmName, versions, registry, clusterOptions, workerEnv, options }) => {
    if (!algorithmName) {
        const msg = 'Unable to create deployment spec. algorithmName is required';
        log.error(msg, { component });
        throw new Error(msg);
    }

    const deployment = deploymentDebugTemplate(algorithmName);
    let deploymentSpec = clonedeep(deployment);
    deploymentSpec = applyNodeSelector(deploymentSpec, clusterOptions);
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.ALGORITHM_DEBUG, workerEnv);
    deploymentSpec = applyImage(deploymentSpec, CONTAINERS.ALGORITHM_DEBUG, versions, registry);
    deploymentSpec = applyAlgorithmName(deploymentSpec, algorithmName, CONTAINERS.ALGORITHM_DEBUG);
    deploymentSpec = applyStorage(deploymentSpec, options.defaultStorage, CONTAINERS.ALGORITHM_DEBUG, 'algorithm-operator-configmap');
    deploymentSpec = applyJaeger(deploymentSpec, CONTAINERS.ALGORITHM_DEBUG, options);
    deploymentSpec = applyDataSourcesVolumes(deploymentSpec);
    deploymentSpec = applyImagePullSecret(deploymentSpec, clusterOptions?.imagePullSecretName);
    const ingressSpec = workerIngress(algorithmName, clusterOptions);
    const serviceSpec = workerService(algorithmName);

    return {
        deploymentSpec,
        ingressSpec,
        serviceSpec
    };
};

module.exports = {
    createKindsSpec
};
