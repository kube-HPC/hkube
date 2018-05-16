const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const kubernetesClient = require('kubernetes-client');
const component = require('../../common/consts/componentNames').K8S;
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

    async createDeployment({ spec }) {
        log.debug(`Creating deployment ${spec.metadata.name}`, { component });
        try {
            const res = await this._client.apis.apps.v1.namespaces(this._namespace).deployments.post({ body: spec });
            return res;
        }
        catch (error) {
            log.error(`unable to create deployment ${spec.metadata.name}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async deleteDeployment(deploymentName) {
        log.debug(`Deleting job ${deploymentName}`, { component });
        try {
            const res = await this._client.apis.apps.v1.namespaces(this._namespace).deployment(deploymentName).delete();
            return res;
        }
        catch (error) {
            log.error(`unable to delete deployment ${deploymentName}. error: ${error.message}`, { component }, error);
        }
        return null;
    }

    async getDeployments({ labelSelector }) {
        const deploymentsRaw = await this._client.apis.apps.v1.namespaces(this._namespace).deployments().get({ qs: { labelSelector } });
        return deploymentsRaw;
    }

    async getVersionsConfigMap() {
        try {
            const configMap = await this._client.api.v1.namespaces(this._namespace).configmaps('hkube-versions').get();
            const versions = JSON.parse(configMap.body.data['versions.json']);
            return versions;
        }
        catch (error) {
            log.error(`unable to get configmap. error: ${error.message}`, { component }, error);
            return null;
        }
    }
}

module.exports = new KubernetesApi();
