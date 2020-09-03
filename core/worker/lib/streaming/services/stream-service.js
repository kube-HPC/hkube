const EventEmitter = require('events');
const Election = require('./election');
const AdaptersProxy = require('../adapters/adapters-proxy');
const ThroughputCollector = require('./throughput-collector');
const ScalerService = require('./scaler-service');
const { streamingEvents } = require('../../consts');

/**
 * This class is responsible start and stop the following services:
 * 1. Auto-scaler
 * 2. Adapters-proxy
 * 3. Election-service
 * 4. Throughput-collector
 */

class StreamService extends EventEmitter {
    init(options) {
        this._options = options.streaming;
    }

    async start(jobData) {
        this._jobData = jobData;
        this._adapters = new AdaptersProxy();
        this._election = new Election(this._options, (a) => this._adapters.addAdapter(a));
        await this._election.start(jobData);
        this._throughput = new ThroughputCollector(this._options, () => this._adapters.throughput());
        this._throughput.on(streamingEvents.THROUGHPUT_CHANGED, (changes) => {
            this.emit(streamingEvents.THROUGHPUT_CHANGED, changes);
        });
        this._scalerService = new ScalerService(this._options, () => this._adapters.scale());
        this._active = true;
    }

    finish() {
        if (!this._active) {
            return;
        }
        this._active = false;
        this._jobData = null;
        this._scalerService.stop();
        this._throughput.stop();
        this._election.stop();
        this._adapters.stop();
        this._scalerService = null;
        this._throughput = null;
        this._election = null;
        this._adapters = null;
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            this._adapters.report(d);
        });
    }
}

module.exports = new StreamService();
