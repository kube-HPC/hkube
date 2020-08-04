const EventEmitter = require('events');
const stateAdapter = require('../states/stateAdapter');
const INTERVAL = 4000;

class Discovery extends EventEmitter {
    async start({ jobId, taskId }) {
        this._discoveryMap = Object.create(null);
        this._discoveryInterval({ jobId, taskId });
    }

    finish() {
        clearInterval(this._interval);
        this._interval = null;
    }

    _discoveryInterval({ jobId, taskId }) {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(async () => {
            if (this._active) {
                return;
            }
            try {
                this._active = true;
                const changes = await this._checkDiscovery({ jobId, taskId });
                if (changes.length > 0) {
                    this.emit('discovery-changed', changes);
                }
            }
            catch (error) { // eslint-disable-line
            }
            finally {
                this._active = false;
            }
        }, INTERVAL);
    }

    async _checkDiscovery({ jobId, taskId }) {
        const changeList = [];
        const list = await stateAdapter.getDiscovery(d => this._isJobDiscovery(d, jobId, taskId));
        list.forEach((d) => {
            const { nodeName, streamingDiscovery: address } = d;
            if (!this._discoveryMap[nodeName]) {
                this._discoveryMap[nodeName] = { list: [] };
            }
            const map = this._discoveryMap[nodeName];
            const item = map.list.find(l => l.address.host === address.host && l.address.port === address.port);
            if (!item) {
                changeList.push({ nodeName, address, type: 'Add' });
                map.list.push({ nodeName, address });
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
        const node = this._discoveryMap[nodeName];
        return (node && node.list.length) || 0;
    }

    _isJobDiscovery(data, jobId, taskId) {
        return data.jobId === jobId && data.taskId !== taskId;
    }
}

module.exports = new Discovery();
