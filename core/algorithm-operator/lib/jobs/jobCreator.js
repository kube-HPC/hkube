const objectPath = require('object-path');
const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../consts/componentNames');
const { ALGORITHM_BUILDER } = require('../consts/containers');
const template = require('../templates/algorithm-builder');
const { createImageName, parseImageName } = require('../helpers/images');
const { awsAccessKeyId, awsSecretAccessKey, s3EndpointUrl } = require('../templates/s3-template');
const { fsBaseDirectory, fsVolumeMounts, fsVolumes } = require('../templates/fs-template');
const component = components.K8S;

const applyName = (inputSpec, buildId) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.name = `build-${buildId}`;
    return spec;
};

const _setImage = (spec, version, registry) => {
    const container = spec.spec.template.spec.containers[0];
    const imageName = container.image;
    const imageParsed = parseImageName(imageName);
    if (registry) {
        imageParsed.registry = registry.registry;
    }
    if (imageParsed.tag) {
        return createImageName(imageParsed);
    }
    if (version) {
        imageParsed.tag = version;
    }
    return createImageName(imageParsed);
};

const applyImage = (spec, version, registry) => {
    const image = _setImage(spec, version, registry);
    const container = spec.spec.template.spec.containers[0];
    container.image = image;
    return spec;
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

const _applyEnvToContainerFromSecretOrConfigMap = (inputSpec, containerName, inputEnv) => {
    return applyEnvToContainer(inputSpec, containerName, inputEnv);
};

const applyBuildId = (inputSpec, buildId) => {
    const spec = clonedeep(inputSpec);
    objectPath.set(spec, 'metadata.labels.build-id', buildId);
    objectPath.set(spec, 'spec.template.metadata.labels.build-id', buildId);
    return applyEnvToContainer(spec, ALGORITHM_BUILDER, { BUILD_ID: buildId });
};


const applyVolumes = (inputSpec, fsVolume) => {
    if (!fsVolume) return inputSpec;
    const spec = clonedeep(inputSpec);

    if (!spec.spec.template.spec.volumes) {
        spec.spec.template.spec.volumes = [];
    }
    const { volumes } = spec.spec.template.spec;
    const index = volumes.findIndex(i => i.name === fsVolume.name);
    if (index !== -1) {
        volumes[index] = fsVolume;
    }
    else {
        volumes.push(fsVolume);
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

const createJobSpec = ({ buildId, version, registry, options }) => {
    if (!buildId) {
        const msg = 'Unable to create job spec. buildId is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(template);
    spec = applyName(spec, buildId);
    spec = applyImage(spec, version, registry);
    spec = applyBuildId(spec, buildId);

    if (options.defaultStorage === 's3') {
        spec = _applyEnvToContainerFromSecretOrConfigMap(spec, ALGORITHM_BUILDER, awsAccessKeyId);
        spec = _applyEnvToContainerFromSecretOrConfigMap(spec, ALGORITHM_BUILDER, awsSecretAccessKey);
        spec = _applyEnvToContainerFromSecretOrConfigMap(spec, ALGORITHM_BUILDER, s3EndpointUrl);
    }
    else if (options.defaultStorage === 'fs') {
        spec = _applyEnvToContainerFromSecretOrConfigMap(spec, ALGORITHM_BUILDER, fsBaseDirectory);
        spec = applyVolumes(spec, fsVolumes);
        spec = applyVolumeMounts(spec, ALGORITHM_BUILDER, fsVolumeMounts);
    }
    return spec;
};

module.exports = {
    createJobSpec,
    applyName,
    applyImage,
    applyBuildId,
    applyEnvToContainer
};
