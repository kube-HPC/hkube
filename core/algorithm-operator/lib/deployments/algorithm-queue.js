const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const decamelize = require('decamelize');
const { applyEnvToContainer, applyResourceRequests, applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const { applyImage, applyJaeger } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { algorithmQueueTemplate } = require('../templates/algorithm-queue');
const { isValidDeploymentName } = require('../helpers/images');
const { createContainerResourceByFactor } = require('../helpers/kubernetes-utils');
const CONTAINERS = require('../consts/containers');
const { settings } = require('../helpers/settings');

const applyAlgorithmName = (inputSpec, algorithmName, containerName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['algorithm-name'] = algorithmName;
    spec.spec.template.metadata.labels['algorithm-name'] = algorithmName;
    spec.spec.selector.matchLabels['algorithm-name'] = algorithmName;
    return applyEnvToContainer(spec, containerName, { ALGORITHM_TYPE: algorithmName });
};

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const applyName = (inputSpec, algorithmName, containerName) => {
    const spec = clonedeep(inputSpec);
    const validName = decamelize(algorithmName, '-');
    if (!isValidDeploymentName(validName)) {
        const msg = `Unable to create deployment spec. ${validName} is not a valid deployment name.`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    const name = `${containerName}-${validName}`;
    spec.metadata.name = name;
    return spec;
};

const applyResources = (inputSpec, resources) => {
    let spec = clonedeep(inputSpec);
    const requests = createContainerResourceByFactor(resources, 1);
    const limits = createContainerResourceByFactor(resources, 2);
    spec = applyResourceRequests(spec, { requests, limits }, CONTAINERS.ALGORITHM_QUEUE);
    return spec;
};

const createDeploymentSpec = ({ algorithmName, versions, registry, clusterOptions, resources, options }) => {
    if (!algorithmName) {
        const msg = 'Unable to create deployment spec. algorithmName is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(algorithmQueueTemplate);
    spec = applyName(spec, algorithmName, CONTAINERS.ALGORITHM_QUEUE);
    spec = applyAlgorithmName(spec, algorithmName, CONTAINERS.ALGORITHM_QUEUE);
    spec = applyImage(spec, CONTAINERS.ALGORITHM_QUEUE, versions, registry);
    spec = applyJaeger(spec, CONTAINERS.ALGORITHM_QUEUE, options);
    spec = applyNodeSelector(spec, clusterOptions);
    if (settings.applyResourceLimits) {
        spec = applyResources(spec, resources);
    }
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    return spec;
};

module.exports = {
    createDeploymentSpec,
    applyNodeSelector,
    applyAlgorithmName
};
