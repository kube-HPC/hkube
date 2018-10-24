const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const kubernetesClient = require('kubernetes-client');
const objectPath = require('object-path');
const delay = require('delay');
const component = require('../../lib/consts/componentNames').K8S;
let log;

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        const k8sOptions = options.kubernetes || {};
        log = Logger.GetLogFromContainer();
        let config;
        if (!k8sOptions.isLocal) {
            try {
                config = kubernetesClient.config.fromKubeconfig();
            }
            catch (error) {
                log.error(`Error initializing kubernetes. error: ${error.message}`, { component }, error);
                return;
            }
        }
        else {
            config = kubernetesClient.config.getInCluster();
        }
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ options: options.kubernetes, url: config.url })}`, { component });
        this._client = new kubernetesClient.Client({ config, version: '1.9' });
        this._namespace = k8sOptions.namespace;
    }

    async getJobForPod(podName) {
        try {
            log.debug(`getJobForPod for pod ${podName}`, { component });
            const pod = await this._client.api.v1.namespaces(this._namespace).pods(podName).get();
            return objectPath.get(pod, 'body.metadata.labels.job-name');
        }
        catch (error) {
            log.error(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
            return null;
        }
    }

    async getPodContainerStatus(podName) {
        try {
            log.debug(`getPodContainers for pod ${podName}`, { component });
            const pod = await this._client.api.v1.namespaces(this._namespace).pods(podName).get();
            const statusRaw = objectPath.get(pod, 'body.status.containerStatuses');
            if (!statusRaw) {
                return [];
            }
            return statusRaw.map(s => ({
                name: s.name,
                running: !!s.state.running,
                terminated: !!s.state.terminated
            }));
        }
        catch (error) {
            log.error(`unable to get pod details ${podName}. error: ${error.message}`, { component }, error);
            return null;
        }
    }

    async waitForTerminatedState(podName, containerName, timeout = 20000) {
        const start = Date.now();
        do {
            log.debug(`waitForTerminatedState for pod ${podName}, container: ${containerName}`, { component });

            const status = await this.getPodContainerStatus(podName); // eslint-disable-line no-await-in-loop
            const containerStatus = status && status.find(s => s.name === containerName);
            log.debug(`waitForTerminatedState for pod ${podName}, container: ${containerName}, status: ${JSON.stringify(containerStatus)}`, { component });
            if (containerStatus && containerStatus.terminated) {
                return true;
            }
            await delay(1000); // eslint-disable-line no-await-in-loop
        } while (Date.now() - start < timeout);
        log.info(`waitForTerminatedState for pod ${podName}, container: ${containerName} timeout waiting for terminated state`, { component });

        return false;
    }

    async deleteJob(jobName) {
        log.debug(`Deleting job ${jobName}`, { component });
        try {
            const res = await this._client.apis.batch.v1.namespaces(this._namespace).jobs(jobName).delete({ body: { propagationPolicy: 'Foreground' } });
            return res;
        }
        catch (error) {
            log.error(`unable to delete job ${jobName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }
}

module.exports = new KubernetesApi();
