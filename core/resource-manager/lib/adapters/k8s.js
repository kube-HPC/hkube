const groupBy = require('lodash.groupby');
const Api = require('kubernetes-client');
const Adapter = require('./Adapter');
const parse = require('@hkube/units-converter');

class K8sAdapter extends Adapter {

    constructor(options) {
        super(options);
        if (options.connection.local) {
            this._client = new Api.Core(Api.config.fromKubeconfig());
        }
        else {
            this._client = new Api.Core(Api.config.getInCluster());
        }
    }

    async getData() {
        let data = this.cache.get();
        if (data) {
            return data;
        }
        let nodes = await this._client.nodes.get();
        let pods = await this._client.pods.get();
        let resourcesStatus = new Map();
        const groupedByNodeName = groupBy(pods.items, 'spec.nodeName');

        nodes.items.forEach((node) => {
            let nodeName = node.metadata.name;
            let allocatableCpu = parse.parseUnitObj(node.status.allocatable.cpu).val;
            let allocatableMemory = parse.parseUnitObj(node.status.allocatable.memory).val;
            let pods = groupedByNodeName[nodeName];
            let cpuRequests = 0;
            let memoryRequests = 0;

            pods.forEach(pod => {
                pod.spec.containers.forEach(container => {
                    if (container.resources.requests != undefined) {
                        cpuRequests += parse.getCpuInMiliCore(container.resources.requests.cpu);
                        memoryRequests += parse.getMemoryInKB(container.resources.requests.memory);
                    }
                });
            });

            let freeCpu = allocatableCpu - cpuRequests;
            let freeMemory = allocatableMemory - memoryRequests;
            resourcesStatus.set(nodeName, { allocatableCpu, allocatableMemory, cpuRequests, memoryRequests, freeCpu, freeMemory })
        });
        this.cache.set(resourcesStatus);
        return resourcesStatus;

    }
}

module.exports = K8sAdapter;