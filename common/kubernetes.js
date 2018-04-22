const EventEmitter = require('events');
const kubernetesClient = require('kubernetes-client');
const objectPath = require('object-path');

class KubernetesApi extends EventEmitter {
    constructor(){
        super();
        this._isInit=false;
    }
    async init(options = {}) {
        const k8sOptions = options.kubernetes || {};
        let config;
        if (!k8sOptions.isLocal) {
            config = kubernetesClient.config.fromKubeconfig();
        }
        else {
            config = kubernetesClient.config.getInCluster();
        }
        console.log(`Initialized kubernetes client with options ${JSON.stringify({ options: options.kubernetes, url: config.url })}`);
        this._client = new kubernetesClient.Client({ config, version: '1.9' });
        this._namespace = k8sOptions.namespace || 'default';
        this._isInit=true;
    }

    
    async getDeploymentReplicas({deployment}){
        if (!this._isInit){
            await this.init();
        }
        const res = await this._client.apis.apps.v1.namespaces(this._namespace).deployments(deployment).get();
        return objectPath.get(res,'body.spec.replicas'); 
    }
}

module.exports = new KubernetesApi();
