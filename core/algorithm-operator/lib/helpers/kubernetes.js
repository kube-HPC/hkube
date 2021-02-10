const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const component = require('../consts/componentNames').K8S;

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        this._namespace = options.kubernetes.namespace;
        this._client = new KubernetesClient(options.kubernetes);
        log.info(`Initialized kubernetes client with options ${JSON.stringify({
            ...options.kubernetes,
            url: this._client._config.url
        })}`, { component });
    }

    get namespace() {
        return this._namespace;
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

    async getSecret({ secretName }) {
        const secretsRaw = await this._client.secrets.get({ secretName });
        return secretsRaw;
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

    async deleteJob(jobName) {
        log.info(`Deleting job ${jobName}`, { component });
        try {
            const res = await this._client.jobs.delete({ jobName });
            return res;
        }
        catch (error) {
            log.error(`unable to delete job ${jobName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getVersionsConfigMap() {
        const res = await this._client.configMaps.get({ name: 'hkube-versions' });
        return this._client.configMaps.extractConfigMap(res);
    }

    async deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name }, type) {
        log.info(`Creating exposed service ${deploymentSpec.metadata.name}`, { component });
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
            await this.deleteExposedDeployment(name, type);
            throw error;
        }
    }

    async updateExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name }, type) {
        log.info(`Updating exposed service ${deploymentSpec.metadata.name}`, { component });
        let resDeployment = null;
        let resIngress = null;
        let resService = null;

        try {
            resDeployment = await this._client.deployments.update({ deploymentName: deploymentSpec.metadata.name, spec: deploymentSpec });
            resIngress = await this._client.ingresses.update({ ingressName: ingressSpec.metadata.name, spec: ingressSpec });
            resService = await this._client.services.update({ serviceName: serviceSpec.metadata.name, spec: serviceSpec });

            return {
                resDeployment,
                resIngress,
                resService
            };
        }
        catch (error) {
            log.error(`failed to continue updating operation ${deploymentSpec.metadata.name}. error: ${error.message}`, { component }, error);
            await this.deleteExposedDeployment(name, type);
            throw error;
        }
    }

    async deleteExposedDeployment(name, type) {
        log.info(`Deleting exposed deployment ${name}`, { component });
        const [resDeployment, resIngress, resService] = await Promise.all([
            this._client.deployments.delete({ deploymentName: `${type}-${name}` }),
            this._client.ingresses.delete({ ingressName: `ingress-${type}-${name}` }),
            this._client.services.delete({ serviceName: `${type}-service-${name}` })
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
