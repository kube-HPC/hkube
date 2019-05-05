const objectPath = require('object-path');
const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyStorage } = require('@hkube/kubernetes-client').utils;
const { applyImage } = require('../helpers/kubernetes-utils');
const components = require('../consts/componentNames');
const { ALGORITHM_BUILDS } = require('../consts/containers');
const template = require('../templates/algorithm-builder');

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

const createBuildJobSpec = ({ buildId, versions, registry, options }) => {
    if (!buildId) {
        const msg = 'Unable to create job spec. buildId is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(template);
    spec = applyName(spec, buildId);
    spec = applyImage(spec, ALGORITHM_BUILDS, versions, registry);
    spec = applyBuildId(spec, buildId);
    spec = applyStorage(spec, options.defaultStorage, ALGORITHM_BUILDS, 'algorithm-operator-configmap');

    return spec;
};

module.exports = {
    createBuildJobSpec,
    applyName
};
