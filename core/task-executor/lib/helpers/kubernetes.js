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
            config = kubernetesClient.config.fromKubeconfig();
        }
        else {
            config = kubernetesClient.config.getInCluster();
        }
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ options: options.kubernetes, url: config.url })}`, { component });
        this._client = new kubernetesClient.Client({ config, version: '1.9' });
        this._namespace = k8sOptions.namespace;
    }

    async createJob({ spec }) {
        log.debug(`Creating job ${spec.metadata.name}`);
        const res = await this._client.apis.batch.v1.namespaces(this._namespace).jobs.post({ body: spec });
        return res;
    }
    async getWorkerJobs() {
        const jobsRaw = await this._client.apis.batch.v1.namespaces(this._namespace).jobs().get({ qs: { labelSelector: 'type=worker,group=hkube' } });
        // const jobsRaw = await this._client.apis.batch.v1.namespaces(this._namespace).jobs().get();
        return jobsRaw;
    }

    async getVersionsConfigMap() {
        const configMap = await this._client.api.v1.namespaces(this._namespace).configmaps('hkube-versions').get();
        const versions = JSON.parse(configMap.body.data['versions.json']);
        return versions;
    }
}

module.exports = new KubernetesApi();
