const { createImage } = require('@hkube/kubernetes-client').utils;
const { settings } = require('../helpers/settings');

const setPipelineDriverImage = (template, versions, registry) => {
    const { image } = template;
    return createImage(image, versions, registry);
};

const _createContainerResourceByFactor = ({ cpu, mem } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memory = `${(mem || 4) * factor}Mi`;
    return { cpu: cpuFactored, memory };
};

const createContainerResource = (template) => {
    const requests = _createContainerResourceByFactor(template || {}, 1);
    const limitFactor = settings.useResourceLimits ? 1 : 2;
    const limits = _createContainerResourceByFactor(template || {}, limitFactor);
    return { requests, limits };
};

module.exports = {
    setPipelineDriverImage,
    createContainerResource
};
