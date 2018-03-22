const groupBy = require('lodash.groupby');
const Api = require('kubernetes-client');
const Adapter = require('./Adapter');
const parse = require('parseunit');

class K8sAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
        if (options.k8s.local) {
            this._client = new Api.Core(Api.config.fromKubeconfig());
        }
        else {
            this._client = new Api.Core(Api.config.getInCluster());
        }
    }

    async getData() {
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
                        cpuRequests += this._getCpuInMiliCore(container.resources.requests.cpu);
                        memoryRequests += this._getMemoryInKB(container.resources.requests.memory);
                    }
                });
            });

            let freeCpu = allocatableCpu - cpuRequests;
            let freeMemory = allocatableMemory - memoryRequests;
            resourcesStatus.set(nodeName, { allocatableCpu, allocatableMemory, cpuRequests, memoryRequests, freeCpu, freeMemory })
        });
        return resourcesStatus;
    }

    _getCpuInMiliCore(cpu) {
        if (!cpu) return 0;
        const res = parse.parseUnitObj(cpu);
        switch (res.unit) {
            case "m":
                return res.val;
            case "": // 0.1 CPU == 100m
                return res.val * 1000;
            default:
                throw new Error(`${res.unit} unit not defined`);
        }
    }

    _getMemoryInKB(memory) {
        if (!memory) return 0;
        const res = parse.parseUnitObj(memory);
        switch (res.unit) {
            case "Ki":
                return res.val;
            case "M":
                return res.val * 1000;
            case "Mi": // mili bytes  0.001Mi == (1/1000)Mi == 1024*1024*(1/1000)bytes = 1024*1024 milli-bytes == 1048576m
                return res.val * 1024 * 1024 / 1000;
            case "Gi":
                return res.val * 1000 * 1000;
            default:
                throw (new Error(`${res.unit} unit not defined`));
        }
    }
}

module.exports = K8sAdapter;