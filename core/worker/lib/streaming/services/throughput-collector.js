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
        this._currentThroughput = [];
        this._lastThroughput = [];
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
        this._currentThroughput = this._getThroughput();
        return this._check();
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
