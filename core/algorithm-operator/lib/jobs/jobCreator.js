const clonedeep = require('lodash.clonedeep');
const { randomString } = require('@hkube/uid');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyResourceRequests, applyEnvToContainer, applyImage, applyStorage, applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const { components, containers } = require('../consts');
const component = components.K8S;
const pipelineDriverTemplate = require('../templates/pipeline-driver');
const { settings } = require('../helpers/settings');
const { applyJaeger, applySidecars } = require('../helpers/kubernetes-utils');
const CONTAINERS = containers;

const applyPipelineDriverResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.PIPELINE_DRIVER);
};

const applyName = (inputSpec, driverName) => {
    const spec = clonedeep(inputSpec);
    const name = `${driverName}-${randomString({ length: 5 })}`;
    spec.metadata.name = name;
    return spec;
};

const applyPipelineDriverImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.PIPELINE_DRIVER);
};

const applyEnvToContainerFromSecretOrConfigMap = (inputSpec, containerName, inputEnv) => {
    return applyEnvToContainer(inputSpec, containerName, inputEnv);
};

const createDriverJobSpec = ({ resourceRequests, image, inputEnv, clusterOptions, options }) => {
    if (!image) {
        const msg = 'Unable to create job spec. image is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(pipelineDriverTemplate);
    spec = applyName(spec, CONTAINERS.PIPELINE_DRIVER);
    spec = applyPipelineDriverImage(spec, image);
    spec = applyEnvToContainer(spec, CONTAINERS.PIPELINE_DRIVER, inputEnv);
    if (settings.applyResourceLimits) {
        spec = applyPipelineDriverResourceRequests(spec, resourceRequests);
    }
    spec = applyJaeger(spec, CONTAINERS.PIPELINE_DRIVER, options);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.PIPELINE_DRIVER, 'algorithm-operator-configmap');
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    spec = applySidecars(spec, clusterOptions, CONTAINERS.PIPELINE_DRIVER);
    return spec;
};

module.exports = {
    createDriverJobSpec,
    applyPipelineDriverImage,
    applyEnvToContainerFromSecretOrConfigMap
};
