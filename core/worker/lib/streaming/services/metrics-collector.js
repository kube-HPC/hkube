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
        this._totalStats = Object.create(null);
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
        const currentMetrics = this._getMetrics();
        const newMetrics = [];
        currentMetrics.forEach(m => {
            const { totalRequests, totalResponses, totalDropped, ...metrics } = m;
            const { source, target } = m;
            const key = `${source}->${target}`;

            if (!this._totalStats[key]) {
                this._totalStats[key] = { requests: 0, responses: 0, dropped: 0 };
            }
            const data = this._totalStats[key];
            const requests = totalRequests - data.requests;
            const responses = totalResponses - data.responses;
            const dropped = totalDropped - data.dropped;

            data.requests += requests;
            data.responses += responses;
            data.dropped += dropped;

            newMetrics.push({ ...metrics, requests, responses, dropped });
        });
        if (newMetrics.length) {
            this.emit(streamingEvents.METRICS_CHANGED, newMetrics);
        }
        return newMetrics;
    }
}

module.exports = MetricsCollector;
