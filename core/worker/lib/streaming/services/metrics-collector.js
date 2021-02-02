const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const { Interval } = require('../core/index');
const { Components, streamingEvents } = require('../../consts');
const component = Components.STREAM_SERVICE;
let log;

class MetricsCollector extends EventEmitter {
    constructor(options, getMetrics) {
        super();
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._getMetrics = getMetrics;
        this._currentMetrics = [];
        this._lastMetrics = [];
        this._start();
    }

    _start() {
        this._metricsInterval = new Interval({ delay: this._options.metrics.interval })
            .onFunc(() => this._checkMetrics())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    stop() {
        this._metricsInterval.stop();
    }

    _checkMetrics() {
        this._currentMetrics = this._getMetrics();
        return this._check();
    }

    _check() {
        if (!isEqual(this._currentMetrics, this._lastMetrics)) {
            this.emit(streamingEvents.METRICS_CHANGED, this._currentMetrics);
            this._lastMetrics = cloneDeep(this._currentMetrics);
            return this._currentMetrics;
        }
        return null;
    }
}

module.exports = MetricsCollector;
