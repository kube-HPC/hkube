const Logger = require('@hkube/logger');
const Adapter = require('./adapter');
const stateAdapter = require('../../states/stateAdapter');
const AutoScaler = require('../services/auto-scaler');
const { Components } = require('../../consts');
const component = Components.MASTER_ADAPTER;
let log;

/**
 * The master is responsible to do the auto-scale,
 * It also watch slaves and handle their scaling.
 */

class MasterAdapter extends Adapter {
    constructor(options) {
        super(options);
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._slaves = Object.create(null);
        this._autoScaler = new AutoScaler(options);
        stateAdapter.watchStreamingStats({ jobId: this.jobId, nodeName: this.nodeName });
        stateAdapter.on(`streaming-statistics-${this.nodeName}`, (data) => {
            if (!this._slaves[data.source]) {
                this._slaves[data.source] = data.nodeName;
                log.info(`new slave (${data.source}) is now connected for node ${data.nodeName}`, { component });
            }
            this._report(data);
        });
    }

    slaves() {
        return Object.keys(this._slaves);
    }

    reset() {
        this._autoScaler.reset();
        this._slaves = Object.create(null);
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

    getThroughput() {
        return this._autoScaler.getThroughput();
    }

    scale() {
        return this._autoScaler.scale();
    }
}

module.exports = MasterAdapter;
