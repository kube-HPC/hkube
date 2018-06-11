const groupBy = require('lodash.groupby');
const Api = require('kubernetes-client');
const Adapter = require('../Adapter');
const parse = require('@hkube/units-converter');
const Cache = require('../../cache/cache-provider');

class K8sAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
        this._cache = new Cache({ key: this.name, maxAge: 1000 * 60 * 1 });
        if (options.k8s.local) {
            this._client = new Api.Core(Api.config.fromKubeconfig());
        }
        else {
            this._client = new Api.Core(Api.config.getInCluster());
        }
    }

    async getData() {
        const data = this._cache.get();
        if (data) {
            return data;
        }
        const nodes = await this._client.nodes.get();
        const kpods = await this._client.pods.get();
        const resourcesStatus = new Map();
        const groupedByNodeName = groupBy(kpods.items, 'spec.nodeName');

        nodes.items.forEach((node) => {
            const nodeName = node.metadata.name;
            const allocatableCpu = parse.parseUnitObj(node.status.allocatable.cpu).val;
            const allocatableMemory = parse.parseUnitObj(node.status.allocatable.memory).val;
            const pods = groupedByNodeName[nodeName];
            let cpuRequests = 0;
            let memoryRequests = 0;

            pods.forEach(pod => {
                pod.spec.containers.forEach(container => {
                    if (container.resources.requests !== undefined) {
                        cpuRequests += parse.getCpuInCore(container.resources.requests.cpu);
                        memoryRequests += parse.getMemoryInMi(container.resources.requests.memory);
                    }
                });
            });

            const freeCpu = allocatableCpu - cpuRequests;
            const freeMemory = allocatableMemory - memoryRequests;
            resourcesStatus.set(nodeName, { allocatableCpu, allocatableMemory, cpuRequests, memoryRequests, freeCpu, freeMemory });
        });
        this._cache.set(resourcesStatus);
        return resourcesStatus;
    }
}

module.exports = K8sAdapter;
