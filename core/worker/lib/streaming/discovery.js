const stateAdapter = require('../states/stateAdapter');
const INTERVAL = 5000;

class Discovery {
    async start({ jobId, taskId }) {
        this._instances = Object.create(null);
        await this._updateDiscovery({ jobId, taskId });
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
                await this._updateDiscovery({ jobId, taskId });
            }
            catch (error) { // eslint-disable-line
            }
            finally {
                this._active = false;
            }
        }, INTERVAL);
    }

    _checkDiscoveryChanges() {

    }

    async _updateDiscovery({ jobId, taskId }) {
        const list = await stateAdapter.getDiscovery(d => this._isJobDiscovery(d, jobId, taskId));
        const result = list.reduce((acc, cur) => {
            const { nodeName } = cur;
            if (!acc[nodeName]) {
                acc[nodeName] = { list: [] };
            }
            acc[nodeName].list.push({ taskId: cur.taskId, address: cur.streamingDiscovery });
            return acc;
        }, {});

        this._instances = result;
    }

    getAddresses(nodes) {
        const addresses = [];
        const nodesF = nodes.filter(n => this._instances[n]);
        nodesF.forEach((n) => {
            const list = this._instances[n].list.map(a => a.address);
            addresses.push(...list);
        });
        return addresses;
    }

    countInstances(nodeName) {
        const node = this._instances[nodeName];
        return (node && node.list.length) || 0;
    }

    _isJobDiscovery(data, jobId, taskId) {
        return data.jobId === jobId && data.taskId !== taskId;
    }
}

module.exports = new Discovery();
