const Logger = require('@hkube/logger');
const { Client: KubernetesClient, utils } = require('@hkube/kubernetes-client');
const { K8S: component } = require('../consts/components');

let log;

class KubernetesApi {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._client = new KubernetesClient(options.kubernetes);
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ ...options.kubernetes, url: this._client._config.url })}`, { component });
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

    async createImageName(image) {
        const { versions, registry } = await this.getVersionsConfigMap();
        return utils.createImage(image, versions, registry);
    }
}

module.exports = new KubernetesApi();
module.exports.KubernetesApi = KubernetesApi;
