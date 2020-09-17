const objectPath = require('object-path');
const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyStorage, applyVolumeMounts: applyVolumeMount, applyVolumes: applyVolume,
    applyPrivileged, applySecret, applyResourceRequests, applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const { applyImage, createContainerResourceByFactor } = require('../helpers/kubernetes-utils');
const components = require('../consts/componentNames');
const { ALGORITHM_BUILDS, KANIKO, OC_BUILDER } = require('../consts/containers');
const { jobTemplate, kanikoContainer, dockerVolumes, kanikoVolumes, openshiftContainer, openshiftVolumes } = require('../templates/algorithm-builder');
const CONTAINERS = require('../consts/containers');
const { settings } = require('../helpers/settings');

const component = components.K8S;

const applyName = (inputSpec, buildId) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.name = `build-${buildId}`;
    return spec;
};

const applyBuildId = (inputSpec, buildId) => {
    const spec = clonedeep(inputSpec);
    objectPath.set(spec, 'metadata.labels.build-id', buildId);
    objectPath.set(spec, 'spec.template.metadata.labels.build-id', buildId);
    return applyEnvToContainer(spec, ALGORITHM_BUILDS, { BUILD_ID: buildId });
};

const applyKanikoContainer = (inputSpec, versions, registry) => {
    let spec = clonedeep(inputSpec);
    spec.spec.template.spec.containers.push(kanikoContainer);
    spec = applyImage(spec, KANIKO, versions, registry);
    return spec;
};

const applyOpenshiftContainer = (inputSpec, versions, registry) => {
    let spec = clonedeep(inputSpec);
    spec.spec.template.spec.containers.push(openshiftContainer);
    spec = applyImage(spec, OC_BUILDER, versions, registry);
    return spec;
};

const applyVolumes = (inputSpec, volumes) => {
    let spec = clonedeep(inputSpec);
    volumes.forEach((volume) => {
        spec = applyVolume(spec, volume);
    });
    return spec;
};

const applyVolumeMounts = (inputSpec, containerName, mounts) => {
    let spec = clonedeep(inputSpec);
    mounts.forEach((mount) => {
        spec = applyVolumeMount(spec, containerName, mount);
    });
    return spec;
};

const applyResources = (inputSpec, resources, container) => {
    let spec = clonedeep(inputSpec);
    const requests = createContainerResourceByFactor(resources, 1);
    const limits = createContainerResourceByFactor(resources, 2);
    spec = applyResourceRequests(spec, { requests, limits }, container);
    return spec;
};

const createBuildJobSpec = ({ buildId, versions, secret, registry, options, clusterOptions }) => {
    if (!buildId) {
        const msg = 'Unable to create job spec. buildId is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(jobTemplate);
    spec = applyName(spec, buildId);
    spec = applyImage(spec, ALGORITHM_BUILDS, versions, registry);
    spec = applyBuildId(spec, buildId);
    spec = applyStorage(spec, options.defaultStorage, ALGORITHM_BUILDS, 'algorithm-operator-configmap');
    spec = applyEnvToContainer(spec, ALGORITHM_BUILDS, { BUILD_MODE: options.buildMode });
    spec = applySecret(spec, ALGORITHM_BUILDS, secret);
    if (settings.applyResourceLimits) {
        spec = applyResources(spec, settings.resourcesMain, CONTAINERS.ALGORITHM_BUILDS);
    }

    if (options.buildMode === 'docker') {
        spec = applyVolumes(spec, dockerVolumes.volumes);
        spec = applyVolumeMounts(spec, ALGORITHM_BUILDS, dockerVolumes.volumeMounts);
        spec = applyPrivileged(spec, true, ALGORITHM_BUILDS);
    }
    else if (options.buildMode === 'kaniko') {
        spec = applyVolumes(spec, kanikoVolumes.volumes);
        spec = applyVolumeMounts(spec, ALGORITHM_BUILDS, kanikoVolumes.volumeMounts);
        spec = applyKanikoContainer(spec, versions, registry);
        if (settings.applyResourceLimits) {
            spec = applyResources(spec, settings.resourcesBuilder, CONTAINERS.KANIKO);
        }
    }
    else if (options.buildMode === 'openshift') {
        spec = applyVolumes(spec, openshiftVolumes.volumes);
        spec = applyVolumeMounts(spec, ALGORITHM_BUILDS, openshiftVolumes.volumeMounts);
        spec = applyOpenshiftContainer(spec, versions, registry);
        if (settings.applyResourceLimits) {
            spec = applyResources(spec, settings.resourcesBuilder, CONTAINERS.OC_BUILDER);
        }
    }
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    return spec;
};

module.exports = {
    createBuildJobSpec,
    applyName
};
