const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const component = require('../../lib/consts/componentNames').K8S;
const { WORKER, SERVICE, INGRESS } = require('../../lib/consts/kubernetes-kind-prefix');

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        this._client = new KubernetesClient(options.kubernetes);
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ ...options.kubernetes, url: this._client._config.url })}`, { component });
    }

    async createDeployment({ spec }) {
        log.info(`Creating deployment ${spec.metadata.name}`, { component });
        try {
            const res = await this._client.deployments.create({ spec });
            return res;
        }
        catch (error) {
            log.error(`unable to create deployment ${spec.metadata.name}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async updateDeployment({ spec }) {
        log.info(`Updating deployment ${spec.metadata.name}`, { component });
        try {
            const res = await this._client.deployments.update({ deploymentName: spec.metadata.name, spec });
            return res;
        }
        catch (error) {
            log.error(`unable to update deployment ${spec.metadata.name}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async deleteDeployment(deploymentName) {
        log.info(`Deleting job ${deploymentName}`, { component });
        try {
            const res = await this._client.deployments.delete({ deploymentName });
            return res;
        }
        catch (error) {
            log.error(`unable to delete deployment ${deploymentName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getDeployments({ labelSelector }) {
        const deploymentsRaw = await this._client.deployments.get({ labelSelector });
        return deploymentsRaw;
    }

    async getJobs({ labelSelector }) {
        const jobsRaw = await this._client.jobs.get({ labelSelector });
        return jobsRaw;
    }

    async createJob({ spec }) {
        log.info(`Creating job ${spec.metadata.name}`, { component });
        try {
            const res = await this._client.jobs.create({ spec });
            return res;
        }
        catch (error) {
            log.error(`unable to create job ${spec.metadata.name}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getVersionsConfigMap() {
        try {
            const res = await this._client.configMaps.get({ name: 'hkube-versions' });
            return this._client.configMaps.extractConfigMap(res);
        }
        catch (error) {
            log.error(`unable to get configmap. error: ${error.message}`, { component }, error);
            return {};
        }
    }

    async createAlgorithmForDebug({ deploymentSpec, ingressSpec, serviceSpec, algorithmName }) {
        log.info(`Creating algorithm for debug ${deploymentSpec.metadata.name}`, { component });
        let resDeployment = null;
        let resIngress = null;
        let resService = null;

        try {
            resDeployment = await this._client.deployments.create({ spec: deploymentSpec });
            resIngress = await this._client.ingresses.create({ spec: ingressSpec });
            resService = await this._client.services.create({ spec: serviceSpec });

            return {
                resDeployment,
                resIngress,
                resService
            };
        }
        catch (error) {
            log.error(`failed to continue creating operation ${deploymentSpec.metadata.name}. error: ${error.message}`, { component }, error);
            await this.deleteAlgorithmForDebug(algorithmName);
            throw error;
        }
    }

    async deleteAlgorithmForDebug(algorithmName) {
        log.info(`Deleting algorithm for debug ${algorithmName}`, { component });
        const [resDeployment, resIngress, resService] = await Promise.all([
            this._client.deployments.delete({ deploymentName: `${WORKER}-${algorithmName}` }),
            this._client.ingresses.delete({ ingressName: `${INGRESS}-${algorithmName}` }),
            this._client.services.delete({ serviceName: `${SERVICE}-${algorithmName}` })
        ]);
        return {
            resDeployment,
            resIngress,
            resService
        };
    }

    async getAlgorithmForDebug({ labelSelector }) {
        const resDeployment = await this._client.deployments.get({ labelSelector });
        const resIngress = await this._client.ingresses.get({ labelSelector });
        const resService = await this._client.services.get({ labelSelector });

        return {
            resDeployment,
            resIngress,
            resService
        };
    }
}

module.exports = new KubernetesApi();
