const log = require('@hkube/logger').GetLogFromContainer();
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const component = require('../consts/componentNames').K8S;
const PodTypes = require('../consts/pod-types');

class KubernetesApi {
    async init(options = {}) {
        this._client = new KubernetesClient(options.kubernetes);
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ ...options.kubernetes, url: this._client._config.url })}`, { component });
    }

    async deleteJob({ podName, jobName }) {
        log.debug(`Deleting job ${jobName}`, { component });
        try {
            const body = {
                kind: 'DeleteOptions',
                apiVersion: 'batch/v1',
                propagationPolicy: 'Foreground'
            };
            await this._client.jobs.delete({ jobName, body });
        }
        catch (e) {
            log.throttle.error(`unable to delete job ${jobName}. error: ${e.message}`, { component }, e);
            if (e.code === 404) {
                // if we didn't find the job we will try to delete the pod
                if (!podName) {
                    log.warning(`podName is not defined for job ${jobName}`, { component });
                }
                else {
                    await this._tryToDeletePod(podName);
                }
            }
            else {
                throw e;
            }
        }
    }

    async _tryToDeletePod(podName) {
        await this._client.pods.delete({ podName });
    }

    async getPodsBySelector(type) {
        return this._client.pods.get({ labelSelector: `type=${type},group=hkube` });
    }

    async getWorkerJobs() {
        return this._client.jobs.get({ labelSelector: `type=${PodTypes.WORKER},group=hkube` });
    }

    async getWorkerPods() {
        return this.getPodsBySelector(PodTypes.WORKER);
    }

    async getPipelineDriversPods() {
        return this.getPodsBySelector(PodTypes.PIPELINE_DRIVER);
    }

    async getAlgorithmBuilderPods() {
        return this.getPodsBySelector(PodTypes.ALGORITHM_BUILDER);
    }
}

module.exports = new KubernetesApi();
