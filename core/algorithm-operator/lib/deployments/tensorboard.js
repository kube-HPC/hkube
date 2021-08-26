const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyStorage, applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const { applyImage } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { deploymentBoardTemplate, boardIngress, boardService } = require('../templates/tensorboard');
const CONTAINERS = require('../consts/containers');

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const createKindsSpec = ({ boardReference, logDir, versions, registry, clusterOptions, options }) => {
    if (!boardReference) {
        const msg = 'Unable to create deployment spec. boardReference is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    const deployment = deploymentBoardTemplate(boardReference);
    let deploymentSpec = clonedeep(deployment);
    deploymentSpec = applyNodeSelector(deploymentSpec, clusterOptions);
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, { logDir });
    deploymentSpec = applyImage(deploymentSpec, CONTAINERS.TENSORBOARD, versions, registry);
    deploymentSpec = applyStorage(deploymentSpec, options.defaultStorage, CONTAINERS.TENSORBOARD, 'algorithm-operator-configmap');
    deploymentSpec = applyImagePullSecret(deploymentSpec, clusterOptions?.imagePullSecretName);

    const ingressSpec = boardIngress(boardReference, clusterOptions);
    const serviceSpec = boardService(boardReference);
    return {
        deploymentSpec,
        ingressSpec,
        serviceSpec
    };
};

module.exports = {
    createKindsSpec
};
