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

    async waitForExitState(podName, containerName) {
        log.info('waiting for container exit state', { component });

        return new Promise((resolve) => {
            this.waitForContainerStatus({
                podName,
                containerName,
                predicate: containerStatus => containerStatus && containerStatus.status !== 'running',
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

    formatContainerMessage(reason) {
        const item = Object.values(CONTAINER_MESSAGE_FORMATS).find(c => c.reasons.includes(reason));
        return item || CONTAINER_MESSAGE_FORMATS.UNKNOWN;
    }
}

module.exports = new KubernetesApi();
module.exports.CONTAINER_MESSAGE_FORMATS = CONTAINER_MESSAGE_FORMATS;
