const Logger = require('@hkube/logger');
const { Interval } = require('../core');
const { Components } = require('../../consts');
const component = Components.STREAM_SERVICE;
let log;

/**
 * This class is responsible for periodically checks
 * if auto-scale should be made and
 * if throughput need to be reported.
 */

class ScalerService {
    constructor(options, autoScale) {
        this._options = options.autoScaler;
        this.autoScale = autoScale;
        log = Logger.GetLogFromContainer();
        this._start();
    }

    async _start() {
        this._autoScaleInterval = new Interval({ delay: this._options.interval })
            .onFunc(() => this.autoScale())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    stop() {
        this._autoScaleInterval.stop();
    }
}

module.exports = ScalerService;
