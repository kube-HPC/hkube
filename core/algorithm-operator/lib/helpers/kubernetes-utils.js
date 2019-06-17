const { utils } = require('@hkube/kubernetes-client');

const applyImage = (inputSpec, containerName, versions, registry) => {
    const image = utils.createImageFromContainer(inputSpec, containerName, versions, registry);
    const spec = utils.applyImage(inputSpec, image, containerName);
    return spec;
};

const createContainerResourceByFactor = ({ cpu, memory } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memoryFactored = `${(memory || 4) * factor}Mi`;
    return { cpu: cpuFactored, memory: memoryFactored };
};
module.exports = {
    applyImage,
    createContainerResourceByFactor
};
