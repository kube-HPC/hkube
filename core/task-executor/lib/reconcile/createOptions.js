const { createImage } = require('@hkube/kubernetes-client').utils;
const { gpuVendors } = require('../consts');
const { settings } = require('../helpers/settings');

/**
 * Resolves the final worker container image name with tag and registry.
 * 
 * If `template.workerImage` is provided, it is used as the base image.
 * Otherwise defaults to `hkube/worker` and attempts to resolve its tag
 * from the provided `versions` object.
 * 
 * The `createImage` utility:
 *  1. Parses the base image into registry/namespace/repository/tag parts.
 *  2. If a matching project is found in `versions`, it uses its image or tag.
 *  3. Adds the provided registry if the image has no registry set.
 *  4. Constructs the final image name with tag.
 *
 * @param {Object} template - Algorithm template.
 * @param {string} [template.workerImage] - Optional explicit worker image.
 * @param {Object} versions - Versions metadata containing `{ versions: [{ project, image?, tag? }] }`.
 * @param {Object} registry - Registry configuration containing `{ registry: string }`.
 * @returns {string|null} Fully qualified container image string, or null if no image could be resolved.
 */
const setWorkerImage = (template, versions, registry) => {
    if (template.workerImage) {
        return createImage(template.workerImage, null, registry);
    }
    const image = 'hkube/worker';
    return createImage(image, versions, registry);
};

/**
 * Resolves the final algorithm container image name with tag and registry.
 *
 * Uses `template.algorithmImage` as the base image and attempts to resolve its
 * tag from the provided `versions` object. The resolution process is identical to the setWorkerImage function.
 * to {@link setWorkerImage} and handled by `createImage`.
 * 
 * @param {Object} template - Algorithm template.
 * @param {string} template.algorithmImage - Algorithm image name.
 * @param {Object} versions - Versions metadata containing `{ versions: [{ project, image?, tag? }] }`.
 * @param {Object} registry - Registry configuration containing `{ registry: string }`.
 * @returns {string|null} Fully qualified container image string, or null if no image could be resolved.
 */
const setAlgorithmImage = (template, versions, registry) => {
    const image = template.algorithmImage;
    return createImage(image, versions, registry);
};

/**
 * Creates container resource requests/limits based on provided values and a scaling factor.
 *
 * @private
 * @param {Object} [resources={}] - Resource requests (cpu in cores, mem in Mi, gpu count).
 * @param {number} [resources.cpu=0.1] - CPU cores.
 * @param {number} [resources.mem=4] - Memory in MiB.
 * @param {number} [resources.gpu] - GPU count.
 * @param {number} [factor=1] - Scaling factor.
 * @returns {Object} Resource configuration object for Kubernetes.
 */
const _createContainerResourceByFactor = ({ cpu, mem, gpu } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memory = `${(mem || 4) * factor}Mi`;
    const gpus = gpu ? { [gpuVendors.NVIDIA]: gpu } : null;
    return { cpu: cpuFactored, memory, ...gpus };
};

/**
 * Creates Kubernetes container resource requests and limits for an algorithm or worker.
 *
 * @param {Object} template - Resource definition (cpu, mem, gpu).
 * @returns {Object} Resource configuration containing `requests` and `limits`.
 */
const createContainerResource = (template) => {
    const requests = _createContainerResourceByFactor(template || {}, 1);
    const limitFactor = settings.useResourceLimits ? 1 : 2;
    const limits = _createContainerResourceByFactor(template || {}, limitFactor);
    return { requests, limits };
};

module.exports = {
    setWorkerImage,
    setAlgorithmImage,
    createContainerResource
};
