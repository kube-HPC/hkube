const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyResourceRequests, applyImagePullSecret, applyStorage } = require('@hkube/kubernetes-client').utils;
const { applyImage, applyJaeger } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { algorithmQueueTemplate } = require('../templates/algorithm-queue');
const { isValidDeploymentName } = require('../helpers/images');
const { createContainerResourceByFactor } = require('../helpers/kubernetes-utils');
const CONTAINERS = require('../consts/containers');
const { settings } = require('../helpers/settings');

const applyQueueId = (inputSpec, queueId, containerName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['queue-id'] = queueId;
    spec.spec.template.metadata.labels['queue-id'] = queueId;
    spec.spec.selector.matchLabels['queue-id'] = queueId;
    return applyEnvToContainer(spec, containerName, { QUEUE_ID: queueId });
};

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const applyName = (inputSpec, queueId, containerName) => {
    const spec = clonedeep(inputSpec);
    if (!isValidDeploymentName(queueId)) {
        const msg = `Unable to create deployment spec. ${queueId} is not a valid deployment name.`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    const name = `${containerName}-${queueId}`;
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

const createDeploymentSpec = ({ queueId, versions, registry, clusterOptions, resources, options }) => {
    if (!queueId) {
        const msg = 'Unable to create deployment spec. queueId is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(algorithmQueueTemplate);
    spec = applyName(spec, queueId, CONTAINERS.ALGORITHM_QUEUE);
    spec = applyQueueId(spec, queueId, CONTAINERS.ALGORITHM_QUEUE);
    spec = applyImage(spec, CONTAINERS.ALGORITHM_QUEUE, versions, registry);
    spec = applyJaeger(spec, CONTAINERS.ALGORITHM_QUEUE, options);
    spec = applyNodeSelector(spec, clusterOptions);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.PIPELINE_DRIVER, 'algorithm-operator-configmap');
    if (settings.applyResourceLimits) {
        spec = applyResources(spec, resources);
    }
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    return spec;
};

module.exports = {
    createDeploymentSpec,
    applyNodeSelector,
    applyQueueId
};
