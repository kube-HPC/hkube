const Adapter = require('./adapter');
const stateAdapter = require('../../states/stateAdapter');
const AutoScaler = require('../services/auto-scaler');

class MasterAdapter extends Adapter {
    constructor(options) {
        super(options);
        this._options = options;
        const { jobId, nodeName } = options;
        stateAdapter.watchStreamingStats({ jobId, nodeName });
        stateAdapter.on(`streaming-statistics-${nodeName}`, (data) => {
            this._report(data);
        });
        this._autoScaler = new AutoScaler(options);
    }

    clean() {
        this._autoScaler.clean();
    }

    report(data) {
        return this._report({ ...data, source: this.source });
    }

    _report(data) {
        return this._autoScaler.report(data);
    }

    finish() {
        const { jobId, nodeName } = this._options;
        stateAdapter.releaseStreamingLock({ jobId, nodeName });
        stateAdapter.unWatchStreamingStats({ jobId, nodeName });
    }

    getProgress() {
        return this._autoScaler.getProgress();
    }

    scale() {
        return this._autoScaler.scale();
    }
}

module.exports = MasterAdapter;
