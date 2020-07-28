const stateAdapter = require('../states/stateAdapter');
const INTERVAL = 2000;

class Discovery {
    async init({ jobId, taskId }) {
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
            catch (error) {
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
            const nodeName = cur.jobData?.nodeName;
            if (!acc[nodeName]) {
                acc[nodeName] = { list: [] };
            }
            acc[nodeName].list.push(cur.taskId);
            return acc;
        }, {});

        // if () {

        // }

        this._instances = result;
    }

    getAddresses(nodes) {
        return nodes
            .filter(n => this._instances[n])
            .map(n => this._instances[n].address);
    }

    count(nodeName) {
        const node = this._instances[nodeName];
        return (node && node.list.length) || 0;
    }

    _isJobDiscovery(data, jobId, taskId) {
        return data.jobId === jobId && data.taskId !== taskId;
    }
}

module.exports = new Discovery();
