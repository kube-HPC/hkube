const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const { Interval } = require('../core');
const { Components, streamingEvents } = require('../../consts');
const component = Components.STREAM_SERVICE;
let log;

class MetricsCollector extends EventEmitter {
    constructor(options, getMetrics) {
        super();
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._getMetrics = getMetrics;
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
        const metrics = this._getMetrics().filter(m => m.metrics?.length);
        if (metrics.length) {
            this.emit(streamingEvents.METRICS_CHANGED, metrics);
        }
        return metrics;
    }
}

module.exports = MetricsCollector;
