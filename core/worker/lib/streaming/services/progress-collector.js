const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const { Interval, Metrics } = require('../core/index');
const { Components, streamingEvents } = require('../../consts');
const component = Components.STREAM_SERVICE;
let log;

class ProgressCollector extends EventEmitter {
    constructor(options, getProgress) {
        super();
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._getProgress = getProgress;
        this._currentProgress = Object.create(null);
        this._lastProgress = Object.create(null);
        this._start();
    }

    _start() {
        this._progressInterval = new Interval({ delay: this._options.progress.interval })
            .onFunc(() => this._checkProgress())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    stop() {
        this._progressInterval.stop();
    }

    _checkProgress() {
        const progress = this._getProgress();
        progress.forEach(p => {
            this._update(p.nodeName, p.progress);
        });
        return this._check();
    }

    _update(nodeName, data) {
        const throughput = [];
        Object.entries(data).forEach(([k, v]) => {
            this._currentProgress[k] = v;
            throughput.push(v);
        });
        const progress = Metrics.Median(throughput);
        this._currentProgress[nodeName] = progress;
    }

    _check() {
        if (!isEqual(this._currentProgress, this._lastProgress)) {
            this.emit(streamingEvents.PROGRESS_CHANGED, this._currentProgress);
            this._lastProgress = cloneDeep(this._currentProgress);
            return this._currentProgress;
        }
        return null;
    }
}

module.exports = ProgressCollector;
