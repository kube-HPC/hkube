const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const { containers, components, sidecars } = require('../consts');
const { settings } = require('./settings');

const component = components.K8S;

class KubernetesApi extends EventEmitter {
    /**
     * Wrap a Kubernetes API call with timeout + retry resilience.
     *
     * The resilience implementation (timeout race, retries, logging hooks) lives
     * in @hkube/kubernetes-client and is configured via the `resilience` options
     * passed to `this._client.init`. This method forwards to it so call sites can
     * keep using `this.withResilience(...)`.
     *
     * @param {Function} fn - Async function that performs the Kubernetes client call.
     * @param {string} label - A short label used in logs to identify the operation.
     * @returns {Promise<*>} Resolves with the value returned by `fn()` on success.
     */
    withResilience(fn, label) {
        return this._client.withResilience(fn, label);
    }

    async init(options = {}) {
        this._namespace = options.kubernetes.namespace;
        this._client = new KubernetesClient();
        await this._client.init({
            ...options.kubernetes,
            resilience: {
                timeoutMs: options.intervalMs,
                retryLimit: options.kubernetes.requestAttemptRetryLimit,
                onRetry: ({ label, attempt, error }) => log.warning(`[Resilience] ${label} attempt ${attempt} failed: ${error.message}. Retrying...`, { component }),
                onError: ({ label, attempts, error }) => log.error(`[Resilience] ${label} failed after ${attempts} attempts: ${error && error.message}`, { component })
            }
        });
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
            const res = await this.withResilience(() => this._client.deployments.create({ spec }), 'createDeployment');
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
            const res = await this.withResilience(() => this._client.deployments.update({ deploymentName: spec.metadata.name, spec }), 'updateDeployment');
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
            const res = await this.withResilience(() => this._client.deployments.delete({ deploymentName }), 'deleteDeployment');
            return res;
        }
        catch (error) {
            log.throttle.error(`unable to delete deployment ${deploymentName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getDeployments({ labelSelector }) {
        const deploymentsRaw = await this.withResilience(() => this._client.deployments.get({ labelSelector }), 'getDeployments');
        return deploymentsRaw;
    }

    async getJobs({ labelSelector }) {
        const jobsRaw = await this.withResilience(() => this._client.jobs.get({ labelSelector }), 'getJobs');
        return jobsRaw;
    }

    async getSecret({ secretName }) {
        const secretsRaw = await this.withResilience(() => this._client.secrets.get({ secretName }), 'getSecret');
        return secretsRaw;
    }

    async createJob({ spec }) {
        log.info(`Creating job ${spec.metadata.name}`, { component });
        try {
            const res = await this.withResilience(() => this._client.jobs.create({ spec }), 'createJob');
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
            const res = await this.withResilience(() => this._client.jobs.delete({ jobName }), 'deleteJob');
            return res;
        }
        catch (error) {
            log.error(`unable to delete job ${jobName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getVersionsConfigMap() {
        const res = await this.withResilience(() => this._client.configMaps.get({ name: 'hkube-versions' }), 'getVersionsConfigMap');
        return this._client.configMaps.extractConfigMap(res);
    }

    async getSidecarConfigs() {
        const ret = await Promise.allSettled(Object.values(sidecars).map(s => this.withResilience(() => this._client.sidecars.get({ name: s }), 'getSidecarConfigs')));
        return ret.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    }

    async deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name }, type) {
        log.info(`Creating exposed service ${deploymentSpec.metadata.name}`, { component });
        let resDeployment = null;
        let resIngress = null;
        let resService = null;

        try {
            resDeployment = await this.withResilience(() => this._client.deployments.create({ spec: deploymentSpec }), 'deployExposedPod-deployment');
            resIngress = await this.withResilience(() => this._client.ingresses.create({ spec: ingressSpec }), 'deployExposedPod-ingress');
            resService = await this.withResilience(() => this._client.services.create({ spec: serviceSpec }), 'deployExposedPod-service');

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
            resDeployment = await this.withResilience(() => this._client.deployments.update({ deploymentName: deploymentSpec.metadata.name, spec: deploymentSpec }), 'updateExposedPod-deployment');
            resIngress = await this.withResilience(() => this._client.ingresses.update({ ingressName: ingressSpec.metadata.name, spec: ingressSpec }), 'updateExposedPod-ingress');
            resService = await this.withResilience(() => this._client.services.update({ serviceName: serviceSpec.metadata.name, spec: serviceSpec }), 'updateExposedPod-service');

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
            this.withResilience(() => this._client.deployments.delete({ deploymentName: `${type}-${name}` }), 'deleteExposedDeployment-deployment'),
            this.withResilience(() => this._client.ingresses.delete({ ingressName: `ingress-${type}-${name}` }), 'deleteExposedDeployment-ingress'),
            this.withResilience(() => this._client.services.delete({ serviceName: `${type}-service-${name}` }), 'deleteExposedDeployment-service')
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
            resIngress = await this.withResilience(() => this._client.ingresses.create({ spec: ingressSpec }), 'createGatewayServiceIngress-ingress');
            resService = await this.withResilience(() => this._client.services.create({ spec: serviceSpec }), 'createGatewayServiceIngress-service');
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
        const jobsRaw = await this.withResilience(() => this._client.jobs.get({ labelSelector: `type=${containers.PIPELINE_DRIVER},group=hkube` }), 'getPipelineDriversJobs');
        return jobsRaw;
    }

    async createDebugServiceIngress({ ingressSpec, serviceSpec, algorithmName }) {
        log.info(`creating service and ingress for ${algorithmName}`, { component });
        let resIngress = null;
        let resService = null;

        try {
            resIngress = await this.withResilience(() => this._client.ingresses.create({ spec: ingressSpec }), 'createDebugServiceIngress-ingress');
            resService = await this.withResilience(() => this._client.services.create({ spec: serviceSpec }), 'createDebugServiceIngress-service');
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
        return this.withResilience(() => this._client.services.get({ labelSelector }), 'getServices');
    }

    async deleteGatewayServiceIngress({ algorithmName }) {
        log.info(`deleting service and ingress for ${algorithmName}`, { component });
        const [ingress, service] = await Promise.all([
            this.withResilience(() => this._client.ingresses.delete({ ingressName: `ingress-gateway-${algorithmName}` }), 'deleteGatewayServiceIngress-ingress'),
            this.withResilience(() => this._client.services.delete({ serviceName: `service-gateway-${algorithmName}` }), 'deleteGatewayServiceIngress-service')
        ]);
        return {
            ingress,
            service
        };
    }

    async deleteDebugServiceIngress({ algorithmName }) {
        log.info(`deleting service and ingress for ${algorithmName}`, { component });
        const [ingress, service] = await Promise.all([
            this.withResilience(() => this._client.ingresses.delete({ ingressName: `ingress-debug-${algorithmName}` }), 'deleteDebugServiceIngress-ingress'),
            this.withResilience(() => this._client.services.delete({ serviceName: `service-debug-${algorithmName}` }), 'deleteDebugServiceIngress-service')
        ]);
        return {
            ingress,
            service
        };
    }
}

module.exports = new KubernetesApi();
