const parse = require('@hkube/units-converter');
const groupBy = require('lodash.groupby');
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const Adapter = require('../Adapter');

class K8sAdapter extends Adapter {
    constructor(options) {
        super(options);
        this._client = new KubernetesClient(options.config.kubernetes);
    }

    _stateFilter(p) {
        return p.status.phase === 'Running' || p.status.phase === 'Pending';
    }

    async _getData() {
        const nodes = await this._client.nodes.get();
        const kpods = await this._client.pods.get();
        const resourcesStatus = new Map();
        const groupedByNodeName = groupBy(kpods.items, 'spec.nodeName');

        nodes.items.forEach((node) => {
            const nodeName = node.metadata.name;
            const allocatableCpu = parse.getCpuInCore(node.status.allocatable.cpu);
            const allocatableMemory = parse.getMemoryInMi(node.status.allocatable.memory);
            const pods = groupedByNodeName[nodeName];
            let cpuRequests = 0;
            let memoryRequests = 0;

            pods.filter(this._stateFilter).forEach(pod => {
                pod.spec.containers.forEach(container => {
                    if (container.resources.requests !== undefined) {
                        cpuRequests += parse.getCpuInCore(container.resources.requests.cpu);
                        memoryRequests += parse.getMemoryInMi(container.resources.requests.memory);
                    }
                });
            });
            resourcesStatus.set(nodeName, { allocatableCpu, allocatableMemory, cpuRequests, memoryRequests });
        });
        return resourcesStatus;
    }
}

module.exports = K8sAdapter;
