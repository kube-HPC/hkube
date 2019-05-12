const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const objectPath = require('object-path');
const delay = require('delay');
const component = require('../../lib/consts').Components.K8S;
const formatters = require('./formatters');

let log;

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();

        try {
            this._client = new KubernetesClient(options.kubernetes);
            log.info(`Initialized kubernetes client with options ${JSON.stringify({ ...options.kubernetes, url: this._client._config.url })}`, { component });

            const kubeVersionRaw = await this._client.versions.get();
            this.kubeVersion = {
                ...kubeVersionRaw.body,
                major: formatters.parseInt(kubeVersionRaw.body.major, 1),
                minor: formatters.parseInt(kubeVersionRaw.body.minor, 9)
            };
            log.info(`kubernetes version: ${this.kubeVersion.major}:${this.kubeVersion.minor}`);
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
            log.error(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
            return null;
        }
    }

    _mapContainerStatus(status) {
        const containerStatus = {
            name: status.name,
            running: !!status.state.running,
            terminated: !!status.state.terminated
        };
        if (containerStatus.terminated) {
            containerStatus.terminationDetails = {
                reason: status.state.terminated.reason,
                exitCode: status.state.terminated.exitCode
            };
        }
        return containerStatus;
    }

    async getPodContainerStatus(podName, containerName) {
        try {
            log.debug(`getPodContainers for pod ${podName}, container ${containerName}`, { component });
            const pod = await this._client.pods.get({ podName });
            const statusRaw = objectPath.get(pod, 'body.status.containerStatuses');
            if (!statusRaw) {
                return [];
            }
            const statuses = statusRaw.filter(r => r.name === containerName).map(this._mapContainerStatus);
            return statuses[0];
        }
        catch (error) {
            log.throttle.error(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
            return null;
        }
    }

    async waitForTerminatedState(podName, containerName, timeout = 20000) {
        log.info('waiting for pod termination', { component });
        const start = Date.now();

        do {
            const containerStatus = await this.getPodContainerStatus(podName, containerName); // eslint-disable-line no-await-in-loop
            log.throttle.debug(`waitForTerminatedState for pod ${podName}, container: ${containerName}, status: ${JSON.stringify(containerStatus)}`, { component });
            if (containerStatus && containerStatus.terminated) {
                return true;
            }
            await delay(1000); // eslint-disable-line no-await-in-loop
        }
        while (Date.now() - start < timeout);

        log.info(`waitForTerminatedState for pod ${podName}, container: ${containerName} timeout waiting for terminated state`, { component });

        return false;
    }

    async deleteJob(jobName) {
        log.debug(`Deleting job ${jobName}`, { component });
        try {
            const res = await this._client.jobs.delete({ jobName, body: { propagationPolicy: 'Foreground' } });
            return res;
        }
        catch (error) {
            log.error(`unable to delete job ${jobName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }
}

module.exports = new KubernetesApi();
