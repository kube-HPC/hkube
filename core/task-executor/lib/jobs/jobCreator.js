const uuidv4 = require('uuid/v4');
const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const objectPath = require('object-path');
const { applyResourceRequests, applyEnvToContainer, applyNodeSelector, applyImage, applyStorage } = require('@hkube/kubernetes-client').utils;
const { components, containers } = require('../consts');
const component = components.K8S;
const { workerTemplate, pipelineDriverTemplate } = require('../templates');
const CONTAINERS = containers;

const applyAlgorithmResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.ALGORITHM);
};

const applyPipelineDriverResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.PIPELINE_DRIVER);
};

const applyEnvToContainerFromSecretOrConfigMap = (inputSpec, containerName, inputEnv) => {
    return applyEnvToContainer(inputSpec, containerName, inputEnv);
};

const applyAlgorithmName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    objectPath.set(spec, 'metadata.labels.algorithm-name', algorithmName);
    objectPath.set(spec, 'spec.template.metadata.labels.algorithm-name', algorithmName);
    return applyEnvToContainer(spec, CONTAINERS.WORKER, { ALGORITHM_TYPE: algorithmName });
};

const applyName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    const name = `${algorithmName}-${uuidv4()}`;
    spec.metadata.name = name;
    return spec;
};

const applyEntryPoint = (inputSpec, entryPoint) => {
    if (entryPoint == null) {
        return inputSpec;
    }
    return applyEnvToContainer(inputSpec, CONTAINERS.ALGORITHM, { ALGORITHM_ENTRY_POINT: entryPoint });
};

const applyHotWorker = (inputSpec, hotWorker) => {
    if (!hotWorker) {
        return inputSpec;
    }
    return applyEnvToContainer(inputSpec, CONTAINERS.WORKER, { HOT_WORKER: 'true' });
};

const applyAlgorithmImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.ALGORITHM);
};

const applyWorkerImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.WORKER);
};

const applyPipelineDriverImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.PIPELINE_DRIVER);
};

const createJobSpec = ({ algorithmName, resourceRequests, workerImage, algorithmImage, workerEnv, algorithmEnv,
    nodeSelector, entryPoint, hotWorker, clusterOptions, options }) => {
    if (!algorithmName) {
        const msg = 'Unable to create job spec. algorithmName is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    if (!algorithmImage) {
        const msg = 'Unable to create job spec. algorithmImage is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(workerTemplate);
    spec = applyName(spec, algorithmName);
    spec = applyAlgorithmName(spec, algorithmName);
    spec = applyAlgorithmImage(spec, algorithmImage);
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, algorithmEnv);
    spec = applyWorkerImage(spec, workerImage);
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, workerEnv);
    spec = applyAlgorithmResourceRequests(spec, resourceRequests);
    spec = applyNodeSelector(spec, nodeSelector, clusterOptions);
    spec = applyHotWorker(spec, hotWorker);
    spec = applyEntryPoint(spec, entryPoint);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.WORKER, 'task-executor-configmap');

    return spec;
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
    spec = applyPipelineDriverResourceRequests(spec, resourceRequests);
    spec = applyNodeSelector(spec, null, clusterOptions);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.PIPELINE_DRIVER, 'task-executor-configmap');

    return spec;
};

module.exports = {
    applyImage,
    createJobSpec,
    createDriverJobSpec,
    applyAlgorithmImage,
    applyWorkerImage,
    applyPipelineDriverImage,
    applyAlgorithmName,
    applyAlgorithmResourceRequests,
    applyHotWorker,
    applyEnvToContainerFromSecretOrConfigMap,
};
