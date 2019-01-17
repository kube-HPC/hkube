const uuidv4 = require('uuid/v4');
const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const objectPath = require('object-path');
const { components, containers } = require('../consts');
const component = components.K8S;
const { workerTemplate, pipelineDriverTemplate } = require('../templates');
const CONTAINERS = containers;

const applyAlgorithmImage = (inputSpec, algorithmImage) => {
    const spec = clonedeep(inputSpec);
    const algorithmContainer = spec.spec.template.spec.containers.find(c => c.name === CONTAINERS.ALGORITHM);
    if (!algorithmContainer) {
        const msg = `Unable to create job spec. ${CONTAINERS.ALGORITHM} container not found`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    algorithmContainer.image = algorithmImage;
    return spec;
};

const applyResourceRequests = (inputSpec, resourceRequests, containerName) => {
    const spec = clonedeep(inputSpec);
    if (!resourceRequests) {
        return spec;
    }
    const container = spec.spec.template.spec.containers.find(c => c.name === containerName);
    if (!container) {
        const msg = `Unable to create job spec. ${containerName} container not found`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    container.resources = { ...container.resources, ...resourceRequests };
    return spec;
};

const applyAlgorithmResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.ALGORITHM);
};

const applyPipelineDriverResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.PIPELINE_DRIVER);
};

const applyImage = (inputSpec, image, containerName) => {
    const spec = clonedeep(inputSpec);
    if (!image) {
        return spec;
    }
    const container = spec.spec.template.spec.containers.find(c => c.name === containerName);
    if (!container) {
        const msg = `Unable to create job spec. ${containerName} container not found`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    container.image = image;
    return spec;
};

const applyWorkerImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.WORKER);
};

const applyPipelineDriverImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.PIPELINE_DRIVER);
};

const applyEnvToContainer = (inputSpec, containerName, inputEnv) => {
    const spec = clonedeep(inputSpec);
    if (!inputEnv) {
        return spec;
    }
    const container = spec.spec.template.spec.containers.find(c => c.name === containerName);
    if (!container) {
        const msg = `Unable to create job spec. ${containerName} container not found`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    if (!container.env) {
        container.env = [];
    }
    const { env } = container;
    Object.entries(inputEnv).forEach(([key, value]) => {
        const index = env.findIndex(i => i.name === key);
        const valueString = (typeof value === 'object') ? value : `${value}`;
        const valueKey = (typeof value === 'object') ? 'valueFrom' : 'value';
        if (index !== -1) {
            if (value == null) {
                env.splice(index, 1);
            }
            else {
                env[index] = { name: key, [valueKey]: valueString };
            }
        }
        else {
            env.push({ name: key, [valueKey]: valueString });
        }
    });
    return spec;
};

const applyEnvToContainerFromSecretOrConfigMap = (inputSpec, containerName, inputEnv) => {
    return applyEnvToContainer(inputSpec, containerName, inputEnv);
};

const applyAlgorithmName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    objectPath.set(spec, 'metadata.labels.algorithm-name', algorithmName);
    objectPath.set(spec, 'spec.template.metadata.labels.algorithm-name', algorithmName);
    spec.spec.template.metadata.labels['algorithm-name'] = algorithmName;
    const workerContainer = spec.spec.template.spec.containers.find(c => c.name === CONTAINERS.WORKER);
    if (!workerContainer) {
        const msg = 'Unable to create job spec. worker container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let algorithmTypeEnv = workerContainer.env.find(e => e.name === 'ALGORITHM_TYPE');
    if (!algorithmTypeEnv) {
        algorithmTypeEnv = { name: 'ALGORITHM_TYPE', value: algorithmName };
        workerContainer.env.push(algorithmTypeEnv);
    }
    else {
        algorithmTypeEnv.value = algorithmName;
    }
    return spec;
};

const applyName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    const name = `${algorithmName}-${uuidv4()}`;
    spec.metadata.name = name;
    return spec;
};

const applyHotWorker = (inputSpec, hotWorker) => {
    if (!hotWorker) {
        return inputSpec;
    }
    return applyEnvToContainer(inputSpec, CONTAINERS.WORKER, { HOT_WORKER: 'true' });
};

const nodeSelectorToNodeAffinity = (nodeSelector) => {
    if (!nodeSelector) {
        return null;
    }
    const matchExpressions = [];
    Object.entries(nodeSelector).forEach(([k, v]) => {
        matchExpressions.push({ key: k, operator: 'In', values: [v] });
    });
    return { nodeSelectorTerms: [{ matchExpressions }] };
};

const applyNodeAffinity = (inputSpec, nodeAffinity) => {
    const spec = clonedeep(inputSpec);
    if (nodeAffinity && Array.isArray(nodeAffinity.nodeSelectorTerms)) {
        spec.spec.template.spec.affinity = {
            nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: {
                    nodeSelectorTerms: nodeAffinity.nodeSelectorTerms
                }
            }
        };
    }
    return spec;
};

const applyNodeSelector = (inputSpec, nodeSelector) => {
    const nodeAffinity = nodeSelectorToNodeAffinity(nodeSelector);
    return applyNodeAffinity(inputSpec, nodeAffinity);
};

const applyVolumes = (inputSpec, fsVolumes) => {
    if (!fsVolumes) return inputSpec;
    const spec = clonedeep(inputSpec);

    if (!spec.spec.template.spec.volumes) {
        spec.spec.template.spec.volumes = [];
    }
    const { volumes } = spec.spec.template.spec;
    const index = volumes.findIndex(i => i.name === fsVolumes.name);
    if (index !== -1) {
        volumes[index] = fsVolumes;
    }
    else {
        volumes.push(fsVolumes);
    }
    return spec;
};

const applyVolumeMounts = (inputSpec, containerName, vm) => {
    if (!vm) return inputSpec;
    const spec = clonedeep(inputSpec);
    const container = spec.spec.template.spec.containers.find(c => c.name === containerName);
    if (!container) {
        const msg = `Unable to create job spec. ${containerName} container not found`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    if (!container.volumeMounts) {
        container.volumeMounts = [];
    }
    const { volumeMounts } = container;
    const index = volumeMounts.findIndex(i => i.name === vm.name);
    if (index !== -1) {
        volumeMounts[index] = vm;
    }
    else {
        volumeMounts.push(vm);
    }
    return spec;
};

const createJobSpec = ({ algorithmName, resourceRequests, workerImage, algorithmImage, workerEnv, algorithmEnv, nodeSelector, hotWorker,
    clusterOptions, options, awsAccessKeyId, awsSecretAccessKey, s3EndpointUrl, fsBaseDirectory, fsVolumes, fsVolumeMounts }) => {
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

    if (options.defaultStorage === 's3') {
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.WORKER, awsAccessKeyId);
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.WORKER, awsSecretAccessKey);
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.WORKER, s3EndpointUrl);
    }
    else if (options.defaultStorage === 'fs') {
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.WORKER, fsBaseDirectory);
        spec = applyVolumes(spec, fsVolumes);
        spec = applyVolumeMounts(spec, CONTAINERS.WORKER, fsVolumeMounts);
    }
    return spec;
};

const createDriverJobSpec = ({ resourceRequests, image, inputEnv, clusterOptions, options, awsAccessKeyId, awsSecretAccessKey,
    s3EndpointUrl, fsBaseDirectory, fsVolumes, fsVolumeMounts }) => {
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
    if (options.defaultStorage === 's3') {
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.PIPELINE_DRIVER, awsAccessKeyId);
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.PIPELINE_DRIVER, awsSecretAccessKey);
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.PIPELINE_DRIVER, s3EndpointUrl);
    }
    else if (options.defaultStorage === 'fs') {
        spec = applyEnvToContainerFromSecretOrConfigMap(spec, CONTAINERS.PIPELINE_DRIVER, fsBaseDirectory);
        spec = applyVolumes(spec, fsVolumes);
        spec = applyVolumeMounts(spec, CONTAINERS.PIPELINE_DRIVER, fsVolumeMounts);
    }
    return spec;
};

module.exports = {
    applyImage,
    createJobSpec,
    createDriverJobSpec,
    applyAlgorithmName,
    applyAlgorithmImage,
    applyWorkerImage,
    applyPipelineDriverImage,
    applyEnvToContainer,
    applyAlgorithmResourceRequests,
    applyHotWorker,
    applyNodeSelector,
    applyNodeAffinity,
    nodeSelectorToNodeAffinity,
    applyEnvToContainerFromSecretOrConfigMap,
    applyVolumes,
    applyVolumeMounts
};
