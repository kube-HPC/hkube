const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const Interval = require('../core/interval');
const stateAdapter = require('../../states/stateAdapter');
const { Components, streamingEvents } = require('../../consts');
const component = Components.SERVICE_DISCOVERY;
let log;

class ServiceDiscovery extends EventEmitter {
    init(options) {
        this._options = options.streaming.serviceDiscovery;
        log = Logger.GetLogFromContainer();
    }

    async start({ jobId, taskId, parents }) {
        this._discoveryMap = Object.create(null);

        this._interval = new Interval({ delay: this._options.interval })
            .onFunc(() => this._discoveryInterval({ jobId, taskId, parents }))
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    finish() {
        this._interval.stop();
    }

    async _discoveryInterval({ jobId, taskId, parents }) {
        const changed = await this._checkDiscovery({ jobId, taskId });
        const changes = changed.filter(c => parents.indexOf(c.nodeName) !== -1);
        if (changes.length > 0) {
            this.emit(streamingEvents.DISCOVERY_CHANGED, changes);
        }
    }

    async _checkDiscovery({ jobId, taskId }) {
        const changeList = [];
        const list = await stateAdapter.getDiscovery(d => this._isJobDiscovery(d, jobId, taskId));
        list.forEach((d) => {
            const { nodeName, streamingDiscovery: address, workerId } = d;
            if (!this._discoveryMap[nodeName]) {
                this._discoveryMap[nodeName] = { list: [] };
            }
            const map = this._discoveryMap[nodeName];
            const item = map.list.find(l => l.address.host === address.host && l.address.port === address.port);
            if (!item) {
                changeList.push({ nodeName, address, type: 'Add' });
                map.list.push({ nodeName, address, workerId });
            }
        });
        Object.values(this._discoveryMap).forEach((v) => {
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
        });
        return changeList;
    }

    countInstances(nodeName) {
        return this.getInstances(nodeName).length;
    }

    getInstances(nodeName) {
        const node = this._discoveryMap[nodeName];
        return (node && node.list) || [];
    }

    _isJobDiscovery(data, jobId, taskId) {
        return data.jobId === jobId && data.taskId !== taskId;
    }
}

module.exports = new ServiceDiscovery();
