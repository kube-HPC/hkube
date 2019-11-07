const { createImage } = require('@hkube/kubernetes-client').utils;
const { gpuVendors } = require('../consts');
const { settings } = require('../helpers/settings');

const setWorkerImage = (template, versions, registry) => {
    const image = template.workerImage || 'hkube/worker';
    return createImage(image, versions, registry);
};

const setAlgorithmImage = (template, versions, registry) => {
    const image = template.algorithmImage;
    return createImage(image, versions, registry);
};

const setPipelineDriverImage = (template, versions, registry) => {
    const { image } = template;
    return createImage(image, versions, registry);
};

const _createContainerResourceByFactor = ({ cpu, mem, gpu } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memory = `${(mem || 4) * factor}Mi`;
    const gpus = gpu ? { [gpuVendors.NVIDIA]: gpu } : null;
    return { cpu: cpuFactored, memory, ...gpus };
};

const createContainerResource = (template) => {
    const requests = _createContainerResourceByFactor(template || {}, 1);
    const limitFactor = settings.useResourceLimits ? 1 : 2;
    const limits = _createContainerResourceByFactor(template || {}, limitFactor);
    return { requests, limits };
};

module.exports = {
    setWorkerImage,
    setAlgorithmImage,
    setPipelineDriverImage,
    createContainerResource
};
