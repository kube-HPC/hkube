/* eslint-disable no-restricted-syntax */
const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const { main } = configIt.load();
const { randomString } = require('@hkube/uid');
const { nodeKind } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const objectPath = require('object-path');
const { applyResourceRequests, applyEnvToContainer, applyNodeSelector, applyImage,
    applyStorage, applyPrivileged, applyVolumes, applyVolumeMounts, applyAnnotation,
    applyImagePullSecret } = require('@hkube/kubernetes-client').utils;
const parse = require('@hkube/units-converter');
const { components, containers, gpuVendors, volumes: volumeKinds, kaiValues } = require('../consts');
const { JAVA } = require('../consts/envs');
const component = components.K8S;
const { hyperparamsTunerEnv, workerTemplate, gatewayEnv, varLog, varlibdockercontainers, varlogMount, varlibdockercontainersMount, sharedVolumeMounts, algoMetricVolume } = require('../templates');
const { settings } = require('../helpers/settings');
const { createContainerResource } = require('../reconcile/createOptions');
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

const applyMounts = (inputSpec, mounts = []) => {
    if (!mounts.length) {
        return inputSpec;
    }
    let spec = clonedeep(inputSpec);
    mounts.forEach((m, i) => {
        const name = `${m.pvcName}-${i}`;
        spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
            name,
            mountPath: m.path
        });
        if (m.volumeType === volumeKinds.emptyDir) {
            spec = applyVolumes(spec, {
                name,
                [volumeKinds.emptyDir]: {}
            });
        }
        else if (m.volumeType === volumeKinds.configMap) {
            spec = applyVolumes(spec, {
                name,
                [volumeKinds.configMap]: {
                    name: m.pvcName
                }
            });
        }
        else {
            spec = applyVolumes(spec, {
                name,
                persistentVolumeClaim: {
                    claimName: m.pvcName
                }
            });
        }
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
    const { isPrivileged } = options.kubernetes;
    const { opengl } = algorithmOptions;
    if (!isPrivileged || !opengl) {
        return inputSpec;
    }
    let spec = clonedeep(inputSpec);
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
    const { devMode, devFolder } = algorithmOptions;
    let devMountPath = '/hkube/algorithm-runner/algorithm_unique_folder';
    if (!devMode) {
        return inputSpec;
    }
    if (!clusterOptions.devModeEnabled) {
        return inputSpec;
    }
    if (devFolder) {
        devMountPath = devFolder;
    }
    let spec = clonedeep(inputSpec);
    objectPath.set(spec, 'spec.template.spec.restartPolicy', 'OnFailure');
    spec = applyEnvToContainer(spec, CONTAINERS.WORKER, { DEV_MODE: 'true' });
    spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, { DEV_MODE: 'true' });
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
        name: 'hkube-dev-sources',
        mountPath: devMountPath,
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

const applyDataSourcesVolumes = (inputSpec, clusterOptions) => {
    let spec = clonedeep(inputSpec);
    if (!clusterOptions?.datasourcesServiceEnabled) {
        return spec;
    }
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

const applyDatascienceMetricsVolumes = (inputSpec, dashboardEnabled) => {
    let spec = clonedeep(inputSpec);
    // if (!clusterOptions.dataSourcesEnabled) {
    //     return spec;
    // }
    spec = applyVolumeMounts(spec, CONTAINERS.ALGORITHM, {
        name: 'datasciencemetrics-storage',
        mountPath: '/hkube/datasciencemetrics-storage'
    });
    if (dashboardEnabled) {
        spec = applyVolumes(spec, {
            name: 'datasciencemetrics-storage',
            persistentVolumeClaim: {
                claimName: 'hkube-datasciencemetrics'
            }
        });
    }
    else {
        spec = applyVolumes(spec, {
            name: 'datasciencemetrics-storage',
            emptyDir: {}
        });
    }
    return spec;
};

const applyCacheParamsToContainer = (inputSpec, reservedMemory) => {
    let spec = clonedeep(inputSpec);
    const envOptions = {};

    if (reservedMemory) {
        envOptions.DISCOVERY_MAX_CACHE_SIZE = parseInt(parse.getMemoryInMi(reservedMemory), 10);
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
    if (options.kubernetes.outputMountPath) {
        varlibdockercontainersMount.mountPath = options.kubernetes.outputMountPath;
        varlibdockercontainers.hostPath.path = options.kubernetes.outputMountPath;
    }
    spec = applyVolumeMounts(spec, CONTAINERS.WORKER, varlibdockercontainersMount);
    spec = applyVolumeMounts(spec, CONTAINERS.WORKER, varlogMount);
    spec = applyVolumes(spec, varlibdockercontainers);
    spec = applyVolumes(spec, varLog);
    return spec;
};
const getJavaMaxMem = (memory) => {
    const val = parse.getMemoryInMi(memory);
    const javaValue = Math.round(val * 0.8);
    return javaValue;
};

const applyKeyVal = (inputSpec, keyVal, type, path) => {
    if (!keyVal) {
        return inputSpec;
    }
    const spec = clonedeep(inputSpec);
    if (!objectPath.get(spec, path)) {
        objectPath.set(spec, path, {});
    }
    const targetKeyVal = objectPath.get(spec, path);

    Object.entries(keyVal).forEach(([key, value]) => {
        const val = objectPath.get(spec, `${path}.${key}`);
        if (val === undefined) {
            targetKeyVal[key] = `${value}`;
        }
        else {
            // we should notify users that some labels/annotations are reserved
            log.throttle.error(`cannot apply reserved ${type} with key ${key}`, { component });
        }
    });
    return spec;
};

const applyLabels = (spec, keyVal) => {
    spec = applyKeyVal(spec, keyVal, 'label', 'metadata.labels');
    return applyKeyVal(spec, keyVal, 'label', 'spec.template.metadata.labels');
};

const applyAnnotations = (spec, keyVal) => {
    spec = applyKeyVal(spec, keyVal, 'annotation', 'metadata.annotations');
    return applyKeyVal(spec, keyVal, 'annotation', 'spec.template.metadata.annotations');
};

const mergeResourceRequest = (defaultResource, customResource) => {
    const mergedRequest = { requests: {}, limits: {} };

    for (const key of ['requests', 'limits']) {
        mergedRequest[key].memory = customResource[key]?.memory || defaultResource[key]?.memory || null;
        mergedRequest[key].cpu = customResource[key]?.cpu || defaultResource[key]?.cpu || null;
    }
    return mergedRequest;
};

const _applyDefaultResourcesSideCar = (container) => {
    const { resources = {} } = container;
    const { requests = {} } = resources;
    const { cpu = main.resources.sideCar.cpu, memory = main.resources.sideCar.memory, gpu } = requests;
    const mem = parse.getMemoryInMi(memory);
    const resourcesWithDefaultLimits = createContainerResource({ cpu, mem, gpu });
    container.resources = mergeResourceRequest(resourcesWithDefaultLimits, resources);
};

const applySidecar = ({ container: sideCarContainer, volumeMounts, environments }, spec) => {
    _applyDefaultResourcesSideCar(sideCarContainer);
    spec.spec.template.spec.containers.push(sideCarContainer);
    if (volumeMounts) {
        volumeMounts.forEach(v => {
            spec = applyVolumeMounts(spec, sideCarContainer.name, v);
        });
    }
    if (environments) {
        Object.entries(environments).forEach(([key, value]) => {
            spec = applyEnvToContainer(spec, sideCarContainer.name, { [key]: value });
        });
    }
    return spec;
};

const applyVolumesAndMounts = (inputSpec, volumes, volumeMounts) => {
    let spec = clonedeep(inputSpec);
    if (volumes) {
        volumes.forEach(v => {
            spec = applyVolumes(spec, v);
        });
    }
    if (volumeMounts) {
        volumeMounts.forEach(v => {
            spec = applyVolumeMounts(spec, containers.ALGORITHM, v);
        });
    }
    return spec;
};

const applySidecars = (inputSpec, customSideCars = [], clusterOptions = {}) => {
    let spec = clonedeep(inputSpec);
    for (const sidecar of settings.sidecars) {
        const { name, container: scContainer, volumeMounts, environments } = sidecar;
        if (!clusterOptions[`${name}SidecarEnabled`]) {
            continue;
        }
        spec = applySidecar({ container: scContainer, volumeMounts, environments }, spec);
    }
    customSideCars.forEach(sideCar => { // Sidecar user-feature
        spec = applySidecar(sideCar, spec);
    });
    return spec;
};

const applyScheduler = (inputSpec, schedulerName) => {
    const spec = clonedeep(inputSpec);
    if (schedulerName) {
        spec.spec.template.spec.schedulerName = schedulerName;
    }
    return spec;
};

/**
 * Applies the configuration from the kaiObject to annotations and labels in the spec.
 * 
 * @param {Object} inputSpec - The job spec that will be updated.
 * @param {Object} kaiObject - The kaiObject containing values to apply to the spec.
 * 
 * @returns {Object} - The updated job spec.
 */
const applyKai = (inputSpec, kaiObject) => {
    let spec = clonedeep(inputSpec);
    if (!kaiObject || Object.keys(kaiObject).length === 0) {
        return spec;
    }
    const { queue, memory, fraction } = kaiObject;
    
    const annotations = {};
    const labels = {};
    if (memory) annotations[kaiValues.ANNOTATIONS.MEMORY] = memory;
    if (fraction) annotations[kaiValues.ANNOTATIONS.FRACTION] = fraction;
    labels[kaiValues.LABELS.QUEUE] = queue;

    spec = applyLabels(spec, labels);
    spec = applyAnnotations(spec, annotations);
    spec = applyScheduler(spec, kaiValues.SCHEDULER_NAME);

    return spec;
};

const createJobSpec = ({ kind, algorithmName, resourceRequests, workerImage, algorithmImage, algorithmVersion, workerEnv, algorithmEnv, labels, annotations, algorithmOptions,
    nodeSelector, entryPoint, hotWorker, clusterOptions, options, workerResourceRequests, mounts, node, reservedMemory, env, workerCustomResources, sideCars, volumes, volumeMounts, kaiObject }) => {
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
    if (settings.applyResources || workerCustomResources) {
        if (workerCustomResources) {
            workerResourceRequests = mergeResourceRequest(workerResourceRequests, workerCustomResources);
        }
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
    spec = applyDataSourcesVolumes(spec, clusterOptions);
    spec = applyMounts(spec, mounts);
    spec = applyImagePullSecret(spec, clusterOptions?.imagePullSecretName);

    if (kind === nodeKind.Gateway) {
        spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, gatewayEnv);
    }
    if (kind === nodeKind.HyperparamsTuner) {
        spec = applyEnvToContainer(spec, CONTAINERS.ALGORITHM, hyperparamsTunerEnv);
        spec = applyDatascienceMetricsVolumes(spec, clusterOptions?.optunaDashboardEnabled);
    }
    spec = applyKai(spec, kaiObject, labels, annotations);
    spec = applyLabels(spec, labels);
    spec = applyAnnotations(spec, annotations);
    spec = applyVolumesAndMounts(spec, volumes, volumeMounts);
    spec = applySidecars(spec, sideCars, clusterOptions);
    return spec;
};

module.exports = {
    applyImage,
    createJobSpec,
    applyAlgorithmImage,
    applyWorkerImage,
    applyAlgorithmName,
    applyAlgorithmResourceRequests,
    applyWorkerResourceRequests,
    applyHotWorker,
    applyEnvToContainerFromSecretOrConfigMap,
    applyCacheParamsToContainer
};
