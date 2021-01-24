const clonedeep = require('lodash.clonedeep');
const { randomString } = require('@hkube/uid');
const log = require('@hkube/logger').GetLogFromContainer();
const objectPath = require('object-path');
const { applyResourceRequests, applyEnvToContainer, applyNodeSelector, applyImage,
    applyStorage, applyPrivileged, applyVolumes, applyVolumeMounts, applyAnnotation,
    applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const parse = require('@hkube/units-converter');
const { components, containers, gpuVendors } = require('../consts');
const { JAVA } = require('../consts/envs');
const component = components.K8S;
const { workerTemplate, logVolumes, logVolumeMounts, pipelineDriverTemplate, sharedVolumeMounts, algoMetricVolume } = require('../templates');
const { settings } = require('../helpers/settings');
const CONTAINERS = containers;

const applyAlgorithmResourceRequests = (inputSpec, resourceRequests, node) => {
    if (!resourceRequests) {
        return inputSpec;
    }
    let spec = clonedeep(inputSpec);
    const gpu = resourceRequests.limits[gpuVendors.NVIDIA];
    if (gpu) {
        spec = applyAnnotation(spec, { [gpuVendors.NVIDIA]: gpu });
        if (!Number.isInteger(gpu)) {
            // remove resource of GPU from template, and add node selector
            delete resourceRequests.requests[gpuVendors.NVIDIA];
            delete resourceRequests.limits[gpuVendors.NVIDIA];
            spec = applyNodeSelector(spec, { 'kubernetes.io/hostname': node });
        }
    }

    spec = applyResourceRequests(spec, resourceRequests, CONTAINERS.ALGORITHM);

    return spec;
};

const applyWorkerResourceRequests = (inputSpec, workerResourceRequests) => {
    return applyResourceRequests(inputSpec, workerResourceRequests, CONTAINERS.WORKER);
};

const applyPipelineDriverResourceRequests = (inputSpec, resourceRequests) => {
    return applyResourceRequests(inputSpec, resourceRequests, CONTAINERS.PIPELINE_DRIVER);
};

const applyEnvToContainerFromSecretOrConfigMap = (inputSpec, containerName, inputEnv) => {
    return applyEnvToContainer(inputSpec, containerName, inputEnv);
};

const applyAlgorithmName = (inputSpec, algorithmName) => {
    let spec = clonedeep(inputSpec);
    objectPath.set(spec, 'metadata.labels.algorithm-name', algorithmName);
    objectPath.set(spec, 'spec.template.metadata.labels.algorithm-name', algorithmName);
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { ALGORITHM_TYPE: algorithmName });
    return applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { ALGORITHM_TYPE: algorithmName });
};

const applyName = (inputSpec, algorithmName) => {
    const spec = clonedeep(inputSpec);
    const name = `${algorithmName}-${randomString({ length: 5 })}`;
    spec.metadata.name = name;
    return spec;
};

const applyEntryPoint = (inputSpec, entryPoint) => {
    if (entryPoint == null) {
        return inputSpec;
    }
    return applyEnvToContainer(inputSpec, CONTAINERS.ALGORITHM, { ALGORITHM_ENTRY_POINT: entryPoint });
};

const applyHotWorker = (inputSpec, hotWorker) => {
    if (!hotWorker) {
        return inputSpec;
    }
    return applyEnvToContainer(inputSpec, CONTAINERS.WORKER, { HOT_WORKER: 'true' });
};

const applyAlgorithmImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.ALGORITHM);
};

const applyWorkerImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.WORKER);
};

const applyPipelineDriverImage = (inputSpec, image) => {
    return applyImage(inputSpec, image, CONTAINERS.PIPELINE_DRIVER);
};

const applyMounts = (inputSpec, mounts = []) => {
    let spec = clonedeep(inputSpec);
    mounts.forEach((m, i) => {
        const name = `${m.pvcName}-${i}`;
        spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
            name,
            mountPath: m.path
        });
        spec = applyVolumes(spec, {
            name,
            persistentVolumeClaim: {
                claimName: m.pvcName
            }
        });
    });
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

const applyOpengl = (inputSpec, options, algorithmOptions = {}) => {
    let spec = clonedeep(inputSpec);
    const { isPrivileged } = options.kubernetes;
    const { opengl } = algorithmOptions;
    if (!isPrivileged || !opengl) {
        return spec;
    }
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { DISPLAY: ':0' });
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { NVIDIA_DRIVER_CAPABILITIES: 'all' });
    // TODO: do we need it?  spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { NVIDIA_VISIBLE_DEVICES: 'all' });
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
        name: 'xsocket',
        mountPath: '/tmp/.X11-unix'
    });
    spec = applyVolumes(spec, {
        name: 'xsocket',
        hostPath: {
            path: '/tmp/.X11-unix'
        }
    });
    return spec;
};

const applyDevMode = (inputSpec, { algorithmOptions = {}, algorithmName, clusterOptions = {} }) => {
    let spec = clonedeep(inputSpec);
    const { devMode } = algorithmOptions;
    if (!devMode) {
        return spec;
    }
    if (!clusterOptions.devModeEnabled) {
        return spec;
    }
    objectPath.set(spec, 'spec.template.spec.restartPolicy', 'OnFailure');
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { DEV_MODE: 'true' });
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { DEV_MODE: 'true' });
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
        name: 'hkube-dev-sources',
        mountPath: '/hkube/algorithm-runner/algorithm_unique_folder',
        subPath: `algorithms/${algorithmName}`
    });
    spec = applyVolumes(spec, {
        name: 'hkube-dev-sources',
        persistentVolumeClaim: {
            claimName: 'hkube-dev-sources-pvc'
        }
    });
    return spec;
};

const applyDataSourcesVolumes = (inputSpec) => {
    let spec = clonedeep(inputSpec);
    // if (!clusterOptions.dataSourcesEnabled) {
    //     return spec;
    // }
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
        name: 'datasources-storage',
        mountPath: '/hkube/datasources-storage'
    });
    spec = applyVolumes(spec, {
        name: 'datasources-storage',
        persistentVolumeClaim: {
            claimName: 'hkube-datasources'
        }
    });
    return spec;
};

const applyCacheParamsToContainer = (inputSpec, reservedMemory) => {
    let spec = clonedeep(inputSpec);
    const envOptions = {};

    if (reservedMemory) {
        envOptions.DISCOVERY_MAX_CACHE_SIZE = parse.getMemoryInMi(reservedMemory);
    }

    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, envOptions);
    return spec;
};

const applyLogging = (inputSpec, options) => {
    let spec = clonedeep(inputSpec);
    const { isPrivileged } = options.kubernetes;
    spec = applyVolumes(spec, algoMetricVolume);
    sharedVolumeMounts.forEach((vm) => {
        spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, vm);
        spec = applyVolumeMounts(spec, CONTAINERS.WORKER, vm);
    });
    if (!isPrivileged) {
        spec = applyVolumeMounts(spec, CONTAINERS.WORKER, {
            name: 'logs',
            mountPath: '/hkube-logs/'
        });
        spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
            name: 'logs',
            mountPath: '/hkube-logs/'
        });
        spec = applyVolumes(spec, {
            name: 'logs',
            emptyDir: {}
        });
        spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { ALGORITHM_LOG_FILE_NAME: 'stdout.log' });
        spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { BASE_LOGS_PATH: '/hkube-logs/' });
        return spec;
    }

    spec = applyPrivileged(spec, isPrivileged, CONTAINERS.WORKER);
    logVolumeMounts.forEach((vm) => {
        spec = applyVolumeMounts(spec, CONTAINERS.WORKER, vm);
    });
    logVolumes.forEach((v) => {
        spec = applyVolumes(spec, v);
    });
    return spec;
};
const getJavaMaxMem = (memory) => {
    const val = parse.getMemoryInMi(memory);
    const javaValue = Math.round(val * 0.8);
    return javaValue;
};
const createJobSpec = ({ algorithmName, resourceRequests, workerImage, algorithmImage, algorithmVersion, workerEnv, algorithmEnv, algorithmOptions,
    nodeSelector, entryPoint, hotWorker, clusterOptions, options, workerResourceRequests, mounts, node, reservedMemory, env }) => {
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
    let spec = clonedeep(workerTemplate);
    spec = applyName(spec, algorithmName);
    spec = applyAlgorithmName(spec, algorithmName);
    spec = applyAlgorithmImage(spec, algorithmImage);
    spec = applyWorkerImage(spec, workerImage);
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, algorithmEnv);
    if (env === JAVA) {
        spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { JAVA_DERIVED_MEMORY: getJavaMaxMem(resourceRequests.limits.memory) });
    }
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, workerEnv);
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { ALGORITHM_IMAGE: algorithmImage });
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { ALGORITHM_VERSION: algorithmVersion });
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { WORKER_IMAGE: workerImage });
    spec = applyAlgorithmResourceRequests(spec, resourceRequests, node);
    if (settings.applyResources) {
        spec = applyWorkerResourceRequests(spec, workerResourceRequests);
    }
    spec = applyNodeSelector(spec, nodeSelector);
    spec = applyHotWorker(spec, hotWorker);
    spec = applyEntryPoint(spec, entryPoint);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.WORKER, 'task-executor-configmap');
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.ALGORITHM, 'task-executor-configmap');
    spec = applyCacheParamsToContainer(spec, reservedMemory);
    spec = applyLogging(spec, options);
    spec = applyOpengl(spec, options, algorithmOptions);
    spec = applyJaeger(spec, CONTAINERS.WORKER, options);
    spec = applyJaeger(spec, CONTAINERS.ALGORITHM, options);
    spec = applyDevMode(spec, { options, algorithmOptions, clusterOptions, algorithmName });
    spec = applyDataSourcesVolumes(spec);
    spec = applyMounts(spec, mounts);
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    return spec;
};

const createDriverJobSpec = ({ resourceRequests, image, inputEnv, clusterOptions, options }) => {
    if (!image) {
        const msg = 'Unable to create job spec. image is required';
        log.error(msg, { component });
        throw new Error(msg);
    }
    let spec = clonedeep(pipelineDriverTemplate);
    spec = applyName(spec, CONTAINERS.PIPELINE_DRIVER);
    spec = applyPipelineDriverImage(spec, image);
    spec = applyEnvToContainer(spec, CONTAINERS.PIPELINE_DRIVER, inputEnv);
    if (settings.applyResources) {
        spec = applyPipelineDriverResourceRequests(spec, resourceRequests);
    }
    spec = applyJaeger(spec, CONTAINERS.PIPELINE_DRIVER, options);
    spec = applyStorage(spec, options.defaultStorage, CONTAINERS.PIPELINE_DRIVER, 'task-executor-configmap');
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    return spec;
};

module.exports = {
    applyImage,
    createJobSpec,
    createDriverJobSpec,
    applyAlgorithmImage,
    applyWorkerImage,
    applyPipelineDriverImage,
    applyAlgorithmName,
    applyAlgorithmResourceRequests,
    applyWorkerResourceRequests,
    applyHotWorker,
    applyEnvToContainerFromSecretOrConfigMap,
    applyCacheParamsToContainer
};
