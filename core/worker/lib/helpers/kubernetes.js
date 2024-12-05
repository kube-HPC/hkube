const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const objectPath = require('object-path');
const delay = require('delay');
const component = require('../consts').Components.K8S;
const formatters = require('./formatters');
let log;

const CONTAINER_MESSAGE_FORMATS = {
    IMAGE: {
        isImagePullErr: true,
        message: 'please check that your image exists and valid',
        reasons: ['ImagePullBackOff', 'ErrImagePull', 'ImageInspectError', 'ErrImageNeverPull', 'RegistryUnavailable', 'InvalidImageName']
    },
    MEMORY: {
        message: 'the algorithm killed due to out of memory, please specify higher memory value',
        reasons: ['OOMKilled']
    },
    UNKNOWN: {
        message: 'the algorithm killed due to an unknown reason, please check the logs for more details',
        reasons: ['Unknown']
    }
};

const CONTAINER_STATUS = {
    RUNNING: 'running'
};

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();

        try {
            this._client = new KubernetesClient(options.kubernetes);
            const kubeVersionRaw = await this._client.versions.get();
            this.kubeVersion = {
                ...kubeVersionRaw.body,
                major: formatters.parseInt(kubeVersionRaw.body.major, 1),
                minor: formatters.parseInt(kubeVersionRaw.body.minor, 9)
            };

            const version = `${this.kubeVersion.major}:${this.kubeVersion.minor}`;
            log.info(`Initialized kubernetes client with version: ${version}, url: ${this._client._config.url}`, { component });
            this.namespace = options.kubernetes.namespace || 'default';
        }
        catch (error) {
            log.error(`Error initializing kubernetes. error: ${error.message}`, { component }, error);
        }
    }

    /**
     * Retrieves the job name associated with a given pod.
     *
     * @param {string} podName - The name of the pod.
     * @returns {Promise<string|null>} - The job name or null if not found.
     */
    async getJobForPod(podName) {
        try {
            log.debug(`getJobForPod for pod ${podName}`, { component });
            const pod = await this._client.pods.get({ podName });
            return objectPath.get(pod, 'body.metadata.labels.job-name');
        }
        catch (error) {
            log.warning(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
            return null;
        }
    }

    /**
     * Retrieves the status of a specific container within a pod.
     *
     * @param {string} podName - The name of the pod.
     * @param {string} containerName - The name of the container.
     * @returns {Promise<Object|null>} - The container status or null if not found.
     */
    async getPodContainerStatus(podName, containerName) {
        let container = null;
        try {
            log.debug(`getPodContainers for pod ${podName}, container ${containerName}`, { component });
            container = await this._client.containers.getStatus({ podName, containerName });
        }
        catch (error) {
            log.throttle.warning(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
        }
        return container;
    }

    /**
     * Waits for a container to reach the "terminated" state.
     *
     * @param {string} podName - The name of the pod.
     * @param {string} containerName - The name of the container.
     * @param {number} [timeout=20000] - The maximum wait time in milliseconds.
     * @returns {Promise<boolean>} - Resolves to true if the container is terminated, otherwise false.
     */
    async waitForTerminatedState(podName, containerName, timeout = 20000) {
        log.info('waiting for container termination', { component });

        return new Promise((resolve) => {
            this.waitForContainerStatus({
                podName,
                containerName,
                timeout,
                predicate: containerStatus => containerStatus && containerStatus.status === 'terminated',
                onStatus: (containerStatus) => {
                    log.throttle.debug(`waiting for container ${containerName}, status: ${JSON.stringify(containerStatus)}`, { component });
                },
                onSuccess: () => {
                    resolve(true);
                },
                onFailed: () => {
                    log.info(`timeout waiting terminated state for container: ${containerName}`, { component });
                    resolve(false);
                }
            });
        });
    }

    /**
     * Waits for a container to exit, i.e., not be in the "running" state.
     *
     * @param {string} podName - The name of the pod.
     * @param {string} containerName - The name of the container.
     * @returns {Promise<Object|null>} - The container status when it exits.
     */
    async waitForExitState(podName, containerName) {
        log.info('waiting for container exit state', { component });

        return new Promise((resolve) => {
            this.waitForContainerStatus({
                podName,
                containerName,
                predicate: containerStatus => containerStatus && containerStatus.status !== CONTAINER_STATUS.RUNNING,
                onStatus: (containerStatus) => {
                    log.throttle.debug(`waiting for container: ${containerName}, status: ${JSON.stringify(containerStatus)}`, { component });
                },
                onSuccess: (containerStatus) => {
                    resolve(containerStatus);
                },
                onFailed: (containerStatus) => {
                    log.info(`timeout waiting exit state for container: ${containerName}`, { component });
                    resolve(containerStatus);
                }
            });
        });
    }

    /**
     * Waits for a container status to match a given predicate.
     *
     * @param {Object} params - Parameters for waiting.
     * @param {string} params.podName - The name of the pod.
     * @param {string} params.containerName - The name of the container.
     * @param {Function} params.predicate - A function that tests the container status.
     * @param {Function} params.onStatus - A callback function to call on each status check.
     * @param {Function} params.onSuccess - A callback function to call if the predicate is met.
     * @param {Function} params.onFailed - A callback function to call if the timeout is reached.
     * @param {number} [params.interval=1000] - The interval between status checks in milliseconds.
     * @param {number} [params.timeout=5000] - The maximum wait time in milliseconds.
     * @returns {Promise<void>} - Resolves when the status is successfully met or times out.
     */
    async waitForContainerStatus({ podName, containerName, predicate, onStatus, onSuccess, onFailed, interval = 1000, timeout = 5000 }) {
        const start = Date.now();
        let containerStatus;
        do {
            containerStatus = await this.getPodContainerStatus(podName, containerName); // eslint-disable-line no-await-in-loop
            if (onStatus) {
                onStatus(containerStatus);
            }
            if (onSuccess && predicate) {
                const res = predicate(containerStatus);
                if (res) {
                    return onSuccess(containerStatus);
                }
            }

            await delay(interval); // eslint-disable-line no-await-in-loop
        }
        while (Date.now() - start < timeout);

        return onFailed && onFailed(containerStatus);
    }

    /**
     * Deletes a Kubernetes job by its name.
     *
     * @param {string} jobName - The name of the job to delete.
     * @returns {Promise<Object|null>} - The result of the job deletion or null if it fails.
     */
    async deleteJob(jobName) {
        log.debug(`Deleting job ${jobName}`, { component });
        try {
            const res = await this._client.jobs.delete({ jobName, body: { propagationPolicy: 'Foreground' } });
            return res;
        }
        catch (error) {
            log.warning(`unable to delete job ${jobName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    /**
     * Formats a message for a container termination reason.
     *
     * @param {string} reason - The termination reason.
     * @returns {Object} - The formatted message and reason details.
     */
    formatContainerMessage(reason) {
        const item = Object.values(CONTAINER_MESSAGE_FORMATS).find(c => c.reasons.includes(reason));
        return item || CONTAINER_MESSAGE_FORMATS.UNKNOWN;
    }

    /**
     * Retrieves the names of all containers in the specified pod.
     *
     * @param {string} podName - The name of the pod.
     * @returns {Promise<string[]>} - A promise that resolves to a list of container names.
     */
    async getContainerNamesForPod(podName) {
        try {
            log.debug(`Fetching container names for pod ${podName}`, { component });
            const pod = await this._client.pods.get({ podName });
            const containers = objectPath.get(pod, 'body.spec.containers', []);
            const containerNames = containers.map(container => container.name);
            return containerNames;
        }
        catch (error) {
            log.warning(`Unable to fetch container names for pod ${podName}. error: ${error.message}`, { component }, error);
            return [];
        }
    }
}

module.exports = new KubernetesApi();
module.exports.CONTAINER_STATUS = CONTAINER_STATUS;
module.exports.CONTAINER_MESSAGE_FORMATS = CONTAINER_MESSAGE_FORMATS;
