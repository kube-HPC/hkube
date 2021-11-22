const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyVolumes, applyVolumeMounts, applyImagePullSecret, applyResourceRequests } = require('@hkube/kubernetes-client').utils;
const { applyImage } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { deployment, service, ingress, storage } = require('../templates/devenv');
const CONTAINERS = require('../consts/containers');

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const createSpec = ({ name, type, resources, devenvResources, storage: devenvStorage, versions, registry, clusterOptions, password }) => {
    if (!name) {
        const msg = 'Unable to create devenv deployment spec. name is required';
        log.error(msg, { component });
        throw new Error(msg);
    }

    if (!type) {
        const msg = 'Unable to create devenv deployment spec. type is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let deploymentSpec = deployment(name, type);
    deploymentSpec = applyNodeSelector(deploymentSpec, clusterOptions);
    deploymentSpec = applyImage(deploymentSpec, CONTAINERS.DEVENV, versions, registry);
    // deploymentSpec = applyStorage(deploymentSpec, options.defaultStorage, CONTAINERS.DEVENV, 'algorithm-operator-configmap');
    deploymentSpec = applyImagePullSecret(deploymentSpec, clusterOptions?.imagePullSecretName);
    if (resources.enable) {
        deploymentSpec = applyResourceRequests(deploymentSpec, devenvResources, CONTAINERS.DEVENV);
    }
    if (devenvStorage?.enable) {
        deploymentSpec = applyVolumes(deploymentSpec, storage.volumes(name, type), CONTAINERS.DEVENV);
        deploymentSpec = applyVolumeMounts(deploymentSpec, CONTAINERS.DEVENV, storage.volumeMounts());
    }
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.DEVENV, { PASSWORD: password });
    const ingressSpec = ingress(name, type, clusterOptions);
    const serviceSpec = service(name, type);
    const storageSpec = devenvStorage?.enable ? storage.pvc(name, type, devenvStorage?.size, devenvStorage?.storageClass) : null;
    return {
        deploymentSpec,
        ingressSpec,
        serviceSpec,
        storageSpec
    };
};

module.exports = {
    createSpec
};
