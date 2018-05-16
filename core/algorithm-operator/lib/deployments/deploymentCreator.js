const clonedeep = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const decamelize = require('decamelize');
const log = Logger.GetLogFromContainer();
const component = require('../../common/consts/componentNames').K8S;
const { algorithmQueueTemplate } = require('./template.js');
const { createImageName, parseImageName, isValidDeploymentName } = require('../helpers/images');

const applyImage = (inputSpec, image) => {
    const spec = clonedeep(inputSpec);
    const algorithmQueueContainer = spec.spec.template.spec.containers.find(c => c.name === 'algorithm-queue');
    if (!algorithmQueueContainer) {
        const msg = 'Unable to create deployment spec. algorithm-queue container not found';
        log.error(msg, { component });
        throw new Error(msg);
    }
    algorithmQueueContainer.image = image;
    return spec;
};

const applyAlgorithmName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['algorithm-name'] = algorithmName;
    const workerContainer = spec.spec.template.spec.containers.find(c => c.name === 'algorithm-queue');
    if (!workerContainer) {
        const msg = 'Unable to create deployment spec. algorithm-queue container not found';
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
    const validName = decamelize(algorithmName, '-');
    if (!isValidDeploymentName(validName)) {
        const msg = `Unable to create deployment spec. ${validName} is not a valid deployment name.`;
        log.error(msg, { component });
        throw new Error(msg);
    }
    const name = `algorithm-queue-${validName}`;
    spec.metadata.name = name;
    return spec;
};

const _setAlgorithmImage = (versions) => {
    const imageName = 'hkube/algorithm-queue';
    const imageParsed = parseImageName(imageName);
    if (imageParsed.tag) {
        return createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    return createImageName(imageParsed);
};

const createDeploymentSpec = ({ algorithmName, versions }) => {
    if (!algorithmName) {
        const msg = 'Unable to create deployment spec. algorithmName is required';
        log.error(msg, { component });
        throw new Error(msg);
    }

    const image = _setAlgorithmImage(versions);

    let spec = clonedeep(algorithmQueueTemplate);
    spec = applyName(spec, algorithmName);
    spec = applyAlgorithmName(spec, algorithmName);
    spec = applyImage(spec, image);
    return spec;
};

module.exports = {
    createDeploymentSpec,
    applyImage,
    applyAlgorithmName,
    applyName
};

