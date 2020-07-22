const clonedeep = require('lodash.clonedeep');
const { applyEnvToContainer, createImageFromContainer, applyImage: utilsApplyImage } = require('@hkube/kubernetes-client').utils;

const applyImage = (inputSpec, containerName, versions, registry) => {
    const image = createImageFromContainer(inputSpec, containerName, versions, registry);
    const spec = utilsApplyImage(inputSpec, image, containerName);
    return spec;
};

const applyJaeger = (inputSpec, container, options) => {
    let spec = clonedeep(inputSpec);
    const { isPrivileged } = options.kubernetes;
    if (isPrivileged) {
        spec = applyEnvToContainer(spec, container, {
            JAEGER_AGENT_SERVICE_HOST: {
                fieldRef: {
                    fieldPath: 'status.hostIP'
                }
            }
        });
    }
    else if (options.jaeger?.host) {
        spec = applyEnvToContainer(spec, container, {
            JAEGER_AGENT_SERVICE_HOST: options.jaeger.host
        });
    }
    return spec;
};
const createContainerResourceByFactor = ({ cpu, memory } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memoryFactored = `${(memory || 4) * factor}Mi`;
    return { cpu: cpuFactored, memory: memoryFactored };
};
module.exports = {
    applyImage,
    createContainerResourceByFactor,
    applyJaeger
};
