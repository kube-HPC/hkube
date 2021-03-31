const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const { stateType: stateTypes } = require('@hkube/consts');
const { Interval } = require('../core');
const stateAdapter = require('../../states/stateAdapter');
const { Components, streamingEvents, workerStates } = require('../../consts');
const component = Components.SERVICE_DISCOVERY;
let log;

/**
 * This class is responsible for periodically check for
 * changes (add, del) of nodes that belongs the current running pipeline.
 * it holds a map of <nodeName, [addresses]>
 * There are two main things it perform:
 * 1. notify the algorithm that it need to connect/disconnet
 * 2. count size of each node, so the auto-scaler can do the scale.
 */

class ServiceDiscovery extends EventEmitter {
    init(options) {
        this._options = options.streaming.serviceDiscovery;
        log = Logger.GetLogFromContainer();
    }

    async start({ jobId, taskId, parents, stateType }) {
        this._discoveryMap = Object.create(null);

        this._interval = new Interval({ delay: this._options.interval })
            .onFunc(() => this._discoveryInterval({ jobId, taskId, parents, stateType }))
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    finish() {
        this._interval?.stop();
    }

    async _discoveryInterval({ jobId, taskId, parents, stateType }) {
        const changed = await this._checkDiscovery({ jobId, taskId });
        const changes = changed.filter(c => parents.indexOf(c.nodeName) !== -1);
        if (changes.length > 0) {
            this.emit(streamingEvents.DISCOVERY_CHANGED, changes);
        }

        if (stateType === stateTypes.Stateful) {
            return; // stateful nodes should not scaled-down
        }

        // scale-down stateless nodes which don't have any parents for x time.
        const parentsAlive = parents.some(p => this._discoveryMap[p]);
        if (parents.length > 0 && !parentsAlive) {
            if (!this._timeWait) {
                this._timeWait = Date.now();
            }
            const diff = Date.now() - this._timeWait;
            if (diff >= this._options.timeWaitOnParentsDown) {
                this._timeWait = null;
                this.emit(streamingEvents.DISCOVERY_PARENTS_DOWN, changes);
            }
        }
    }

    async _checkDiscovery({ jobId, taskId }) {
        const changeList = [];
        const list = await stateAdapter.getDiscovery(d => this._isJobDiscovery(d, jobId, taskId));
        list.forEach((d) => {
            const { nodeName, streamingDiscovery: address, workerId, isMaster } = d;
            if (!this._discoveryMap[nodeName]) {
                this._discoveryMap[nodeName] = { list: [] };
            }
            const map = this._discoveryMap[nodeName];
            const item = map.list.find(l => l.address.host === address.host && l.address.port === address.port);
            if (!item) {
                changeList.push({ nodeName, address, type: 'Add' });
                map.list.push({ nodeName, address, workerId, isMaster });
            }
        });
        Object.entries(this._discoveryMap).forEach(([k, v]) => {
            for (let i = v.list.length - 1; i >= 0; i -= 1) {
                const { nodeName, address } = v.list[i];
                const found = list.find(f => f.nodeName === nodeName
                    && f.streamingDiscovery.host === address.host
                    && f.streamingDiscovery.port === address.port);
                if (!found) {
                    changeList.push({ nodeName, address, type: 'Del' });
                    v.list.splice(i, 1);
                }
            }
            if (v.list.length === 0) {
                delete this._discoveryMap[k];
            }
        });
        return changeList;
    }

    countInstances(nodeName) {
        return this.getInstances(nodeName).length;
    }

    getInstances(nodeName) {
        const node = this._discoveryMap[nodeName];
        const list = node?.list || [];
        return list;
    }

    _isJobDiscovery(data, jobId, taskId) {
        return data.jobId === jobId && data.taskId !== taskId && (data.workerStatus === workerStates.working || data.workerStatus === workerStates.stop);
    }
}

module.exports = new ServiceDiscovery();
