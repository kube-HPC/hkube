const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const { Interval } = require('../core/index');
const { Components, streamingEvents } = require('../../consts');
const component = Components.STREAM_SERVICE;
let log;

class ThroughputCollector extends EventEmitter {
    constructor(options, getThroughput) {
        super();
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._getThroughput = getThroughput;
        this._currentThroughput = Object.create(null);
        this._lastThroughput = Object.create(null);
        this._start();
    }

    _start() {
        this._throughputInterval = new Interval({ delay: this._options.throughput.interval })
            .onFunc(() => this._checkThroughput())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    stop() {
        this._throughputInterval.stop();
    }

    _checkThroughput() {
        const throughput = this._getThroughput();
        throughput.forEach(p => {
            this._update(p.throughput);
        });
        return this._check();
    }

    _update(data) {
        Object.entries(data).forEach(([k, v]) => {
            this._currentThroughput[k] = v;
        });
    }

    _check() {
        if (!isEqual(this._currentThroughput, this._lastThroughput)) {
            this.emit(streamingEvents.THROUGHPUT_CHANGED, this._currentThroughput);
            this._lastThroughput = cloneDeep(this._currentThroughput);
            return this._currentThroughput;
        }
        return null;
    }
}

module.exports = ThroughputCollector;
