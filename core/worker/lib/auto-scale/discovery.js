const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const INTERVAL = 2000;

class AutoScaler {
    async init(jobData) {
        this._jobData = jobData;
        this._workload = Object.create(null);
        this._instances = Object.create(null);

        stateAdapter.on('discovery-change', (data) => {
            if (this._filterDiscovery(data)) {
                this._instances[data.nodeName].count += 1;
            }
        });
        stateAdapter.on('discovery-delete', (data) => {
            if (this._filterDiscovery(data)) {
                this._instances[data.nodeName].count -= 1;
            }
        });
    }

    async _getDiscovery({ jobId }) {
        const list = await stateAdapter.getDiscovery(d => this._filterDiscovery(d, jobId));
    }

    _filterDiscovery(data, { jobId, nodeName }) {
        return data.jobId === jobId;
    }
}

module.exports = new AutoScaler();
