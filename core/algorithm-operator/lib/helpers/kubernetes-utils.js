const clonedeep = require('lodash.clonedeep');
const { applyEnvToContainer, createImageFromContainer, applyImage: utilsApplyImage } = require('@hkube/kubernetes-client').utils;
const { getIngressApiVersion, getIngressBackend, applyVolumeMounts, applyVolumes } = require('@hkube/kubernetes-client').utils;
const kubernetesApi = require('./kubernetes');
const { settings } = require('./settings');
const applyImage = (inputSpec, containerName, versions, registry) => {
    const image = createImageFromContainer(inputSpec, containerName, versions, registry);
    const spec = utilsApplyImage(inputSpec, image, containerName);
    return spec;
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

const getIngressParams = (serviceName, servicePort) => {
    const { kubeVersion } = kubernetesApi;
    const apiVersion = getIngressApiVersion(kubeVersion);
    const { backend, pathType } = getIngressBackend(serviceName, servicePort, kubeVersion);
    return { apiVersion, backend, pathType };
};

module.exports = {
    applyImage,
    createContainerResourceByFactor,
    applyJaeger,
    getIngressParams,
    applySidecars
};
