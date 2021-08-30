const clonedeep = require('lodash.clonedeep');
const { applyEnvToContainer, createImageFromContainer, applyImage: utilsApplyImage, applyVolumes, applyVolumeMounts } = require('@hkube/kubernetes-client').utils;
const { settings } = require('./settings');

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

const applySidecars = (inputSpec, clusterOptions = {}, serviceContainer) => {
    let spec = clonedeep(inputSpec);
    for (const sidecar of settings.sidecars) {
        const { name, container, volumes, volumeMounts, environments } = sidecar;
        if (!clusterOptions[`${name}SidecarEnabled`]) {
            continue;
        }
        spec.spec.template.spec.containers.push(...container);
        if (volumes) {
            volumes.forEach((v) => {
                spec = applyVolumes(spec, v);
            });
        }
        if (volumeMounts) {
            volumeMounts.forEach((v) => {
                spec = applyVolumeMounts(spec, serviceContainer, v);
            });
        }
        if (environments) {
            environments.forEach((v) => {
                spec = applyEnvToContainer(spec, serviceContainer, { [v.name]: v.value });
            });
        }
    }
    return spec;
};

module.exports = {
    applyImage,
    createContainerResourceByFactor,
    applyJaeger,
    applySidecars
};
