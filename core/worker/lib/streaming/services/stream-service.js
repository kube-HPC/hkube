const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const Progress = require('../core/progress');
const Interval = require('../core/interval');
const Election = require('./election');
const { Components, streamingEvents } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * This class is responsible for periodically checks
 * if auto-scale should be made and
 * if progress need to be reported.
 */

class StreamService extends EventEmitter {
    init(options) {
        this._options = options.streaming;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._progress = new Progress();
        this._progress.on(streamingEvents.PROGRESS_CHANGED, (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
        });
        this._election = new Election(this._options);
        this._adapters = await this._election.start(jobData);

        this._autoScaleInterval = new Interval({ delay: this._options.autoScaler.interval })
            .onFunc(() => this.autoScale())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();

        this._progressInterval = new Interval({ delay: this._options.progress.interval })
            .onFunc(() => this.checkProgress())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
        this._active = true;
    }

    finish() {
        this._active = false;
        this._autoScaleInterval.stop();
        this._progressInterval.stop();
        this._election.finish();
        this._adapters.finish();
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            this._adapters.report({ ...d, jobId: this._jobData.jobId });
        });
    }

    autoScale() {
        this._adapters.scale();
    }

    checkProgress() {
        const progress = this._adapters.progress();
        progress.forEach(p => {
            this._progress.update(p.nodeName, p.progress);
        });
        return this._progress.check();
    }
}

module.exports = new StreamService();
