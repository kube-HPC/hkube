
const Api = require('kubernetes-client');
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').K8s;

class K8sAdapter extends Adapter {

    constructor(options) {
        super(options);
        if (options.adapter.connection.local) {
            this._client = new Api.Core({
                url: `${options.adapter.connection.host}:${options.adapter.connection.port}`,
                insecureSkipTlsVerify: true,
                auth: {
                    user: options.adapter.connection.user,
                    pass: options.adapter.connection.pass
                }
            });
        }
        else {
            let clusterConfig = new Api.Core(Api.config.getInCluster());
            this._client = new Api.Core(clusterConfig);
        }
    }

    async getData() {
        let nodes = await this._client.nodes.get();
        return nodes.items.map(n => Object.assign({}, { name: n.metadata.name }, { cpu: n.status.allocatable.cpu }, { memory: n.status.allocatable.memory }));
    }
}

module.exports = K8sAdapter;