const EventEmitter = require('events');
const { StatusCodes } = require('http-status-codes');
const log = require('@hkube/logger').GetLogFromContainer();
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const { containers, components, sidecars } = require('../consts');
const { settings } = require('./settings');

const component = components.K8S;

class KubernetesApi extends EventEmitter {
    async init(options = {}) {
        this._namespace = options.kubernetes.namespace;
        this._client = new KubernetesClient();
        await this._client.init(options.kubernetes);
        this.kubeVersion = await this._client.versions.getParsedVersion();
        log.info(`Initialized kubernetes client with version: ${this.kubeVersion.version} (${this.kubeVersion.gitVersion}), url: ${this._client._config.url}`, { component });

        settings.sidecars = await this.getSidecarConfigs();
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
        log.throttle.info(`Updating deployment ${spec.metadata.name}`, { component });
        try {
            const res = await this._client.deployments.update({ deploymentName: spec.metadata.name, spec });
            return res;
        }
        catch (error) {
            log.throttle.error(`unable to update deployment ${spec.metadata.name}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async deleteDeployment({ deploymentName }) {
        log.throttle.info(`Deleting deployment ${deploymentName}`, { component });
        try {
            const res = await this._client.deployments.delete({ deploymentName });
            return res;
        }
        catch (error) {
            log.throttle.error(`unable to delete deployment ${deploymentName}. error: ${error.message}`, { component }, error);
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

    async getSidecarConfigs() {
        const ret = await Promise.allSettled(Object.values(sidecars).map(s => this._client.sidecars.get({ name: s })));
        return ret.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    }

    async _ignoreAlreadyExistsError(promise) {
        try {
            return await promise;
        }
        catch (error) {
            if (error.code === StatusCodes.CONFLICT) {
                return null;
            }
            throw error;
        }
    }

    async deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, storageSpec, name }, type) {
        log.info(`Creating exposed service ${deploymentSpec.metadata.name}`, { component });
        let resDeployment = null;
        let resIngress = null;
        let resService = null;
        let resStorage = null;
        try {
            resDeployment = await this._client.deployments.create({ spec: deploymentSpec });
            resIngress = await this._ignoreAlreadyExistsError(this._client.ingresses.create({ spec: ingressSpec }));
            resService = await this._ignoreAlreadyExistsError(this._client.services.create({ spec: serviceSpec }));
            if (storageSpec) {
                resStorage = await this._ignoreAlreadyExistsError(this._client.pvc.create({ spec: storageSpec }));
            }
            return {
                resDeployment,
                resIngress,
                resService,
                resStorage
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

    async deleteExposedDeployment(name, type, deletePvc = true) {
        log.info(`Deleting exposed deployment ${name}`, { component });
        const [resDeployment, resIngress, resService] = await Promise.allSettled([
            this._client.deployments.delete({ deploymentName: `${type}-${name}` }),
            this._client.ingresses.delete({ ingressName: `ingress-${type}-${name}` }),
            this._client.services.delete({ serviceName: `${type}-service-${name}` }),
            deletePvc ? this._client.pvc.delete({ name: `claim-${type}-${name}` }) : Promise.resolve()

        ]);
        return {
            resDeployment,
            resIngress,
            resService
        };
    }

    async createGatewayServiceIngress({ ingressSpec, serviceSpec, algorithmName }) {
        log.info(`creating service and ingress for ${algorithmName}`, { component });
        let resIngress = null;
        let resService = null;

        try {
            resIngress = await this._client.ingresses.create({ spec: ingressSpec });
            resService = await this._client.services.create({ spec: serviceSpec });
        }
        catch (error) {
            log.throttle.error(`failed to create service and ingress for ${algorithmName}. error: ${error.message}`, { component }, error);
        }
        return {
            resIngress,
            resService
        };
    }

    async getPipelineDriversJobs() {
        const jobsRaw = await this._client.jobs.get({ labelSelector: `type=${containers.PIPELINE_DRIVER},group=hkube` });
        return jobsRaw;
    }

    async createDebugServiceIngress({ ingressSpec, serviceSpec, algorithmName }) {
        log.info(`creating service and ingress for ${algorithmName}`, { component });
        let resIngress = null;
        let resService = null;

        try {
            resIngress = await this._client.ingresses.create({ spec: ingressSpec });
            resService = await this._client.services.create({ spec: serviceSpec });
        }
        catch (error) {
            log.throttle.error(`failed to create service and ingress for ${algorithmName}. error: ${error.message}`, { component }, error);
        }
        return {
            resIngress,
            resService
        };
    }

    async getServices({ labelSelector }) {
        return this._client.services.get({ labelSelector });
    }

    async deleteGatewayServiceIngress({ algorithmName }) {
        log.info(`deleting service and ingress for ${algorithmName}`, { component });
        const [ingress, service] = await Promise.all([
            this._client.ingresses.delete({ ingressName: `ingress-gateway-${algorithmName}` }),
            this._client.services.delete({ serviceName: `service-gateway-${algorithmName}` })
        ]);
        return {
            ingress,
            service
        };
    }

    async deleteDebugServiceIngress({ algorithmName }) {
        log.info(`deleting service and ingress for ${algorithmName}`, { component });
        const [ingress, service] = await Promise.all([
            this._client.ingresses.delete({ ingressName: `ingress-debug-${algorithmName}` }),
            this._client.services.delete({ serviceName: `service-debug-${algorithmName}` })
        ]);
        return {
            ingress,
            service
        };
    }
}

module.exports = new KubernetesApi();
