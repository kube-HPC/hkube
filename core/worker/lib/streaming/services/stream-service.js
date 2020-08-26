const EventEmitter = require('events');
const Election = require('./election');
const ProgressCollector = require('./progress-collector');
const ScalerService = require('./scaler-service');
const { streamingEvents } = require('../../consts');

/**
 * This class is responsible for periodically checks
 * if auto-scale should be made and
 * if progress need to be reported.
 */

class StreamService extends EventEmitter {
    init(options) {
        this._options = options.streaming;
    }

    async start(jobData) {
        this._jobData = jobData;
        this._election = new Election(this._options);
        this._adapters = await this._election.start(jobData);
        this._progress = new ProgressCollector(this._options, () => this._adapters.progress());
        this._progress.on(streamingEvents.PROGRESS_CHANGED, (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
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
        this._progress.stop();
        this._election.stop();
        this._adapters.stop();
        this._scalerService = null;
        this._progress = null;
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
