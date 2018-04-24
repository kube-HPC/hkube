const uuidv4 = require('uuid/v4');
const clonedeep = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const component = require('../../common/consts/componentNames').K8S;
const { jobTemplate } = require('./template.js');

const applyAlgorithmImage = (inputSpec, algorithmImage) => {
    const spec = clonedeep(inputSpec);
    const algorithmContainer = spec.spec.template.spec.containers.find(c => c.name === 'algorunner');
    if (!algorithmContainer) {
        const msg = 'Unable to create job spec. algorithm container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    algorithmContainer.image = algorithmImage;
    return spec;
};

const applyResourceRequests = (inputSpec, resourceRequests) => {
    const spec = clonedeep(inputSpec);
    if (!resourceRequests) {
        return spec;
    }
    const algorithmContainer = spec.spec.template.spec.containers.find(c => c.name === 'algorunner');
    if (!algorithmContainer) {
        const msg = 'Unable to create job spec. algorithm container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    algorithmContainer.resources = { ...algorithmContainer.resources, requests: resourceRequests };
    return spec;
};
const applyResourceLimits = (inputSpec, resourceLimits) => {
    const spec = clonedeep(inputSpec);
    if (!resourceLimits) {
        return spec;
    }
    const algorithmContainer = spec.spec.template.spec.containers.find(c => c.name === 'algorunner');
    if (!algorithmContainer) {
        const msg = 'Unable to create job spec. algorithm container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    algorithmContainer.resources = { ...algorithmContainer.resources, limits: resourceLimits };
    return spec;
};

const applyWorkerImage = (inputSpec, workerImage) => {
    const spec = clonedeep(inputSpec);
    if (!workerImage) {
        return spec;
    }
    const workerContainer = spec.spec.template.spec.containers.find(c => c.name === 'worker');
    if (!workerContainer) {
        const msg = 'Unable to create job spec. worker container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    workerContainer.image = workerImage;
    return spec;
};

const applyAlgorithmName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['algorithm-name'] = algorithmName;
    const workerContainer = spec.spec.template.spec.containers.find(c => c.name === 'worker');
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

const createJobSpec = ({ algorithmName, resourceRequests, resourceLimits, workerImage, algorithmImage }) => {
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
    let spec = clonedeep(jobTemplate);
    spec = applyName(spec, algorithmName);
    spec = applyAlgorithmName(spec, algorithmName);
    spec = applyAlgorithmImage(spec, algorithmImage);
    spec = applyWorkerImage(spec, workerImage);
    spec = applyResourceRequests(spec, resourceRequests);
    spec = applyResourceLimits(spec, resourceLimits);

    return spec;
};

module.exports = {
    createJobSpec,
    applyAlgorithmName,
    applyAlgorithmImage,
    applyWorkerImage,
    applyResourceRequests

};

