const Logger = require('@hkube/logger');
const Interval = require('./interval');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * This class is responsible for holding the data
 * of required replicas at any moment, and also
 * the logic of scale up/down feasibility
 */
class PendingScale {
    constructor(config, methods) {
        log = Logger.GetLogFromContainer();
        this._minTimeBetweenScales = config.minTimeBetweenScales;
        this._scaleInterval = config.scaleInterval;
        this._getUnScheduledAlgorithms = methods.getUnScheduledAlgorithms;
        this._getCurrentSize = methods.getCurrentSize;
        this._scaleUp = methods.scaleUp;
        this._scaleDown = methods.scaleDown;
        this._required = 0;
        this._desired = 0;
        this._lastScaleUpTime = null;
        this._lastScaleDownTime = null;
        this._startInterval();
    }

    stop() {
        this._scaleInterval?.stop();
    }

    _startInterval() {
        this._scaleInterval = new Interval({ delay: this._scaleInterval })
            .onFunc(() => this._checkScale())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    async _checkScale() {
        const currentSize = this._getCurrentSize();
        const unScheduledAlgorithm = await this._getUnScheduledAlgorithms();
        if (unScheduledAlgorithm) {
            return;
        }
        const shouldScaleUp = this._shouldScaleUp(currentSize);
        const shouldScaleDown = this._shouldScaleDown(currentSize);

        let canScaleUp = false;
        let canScaleDown = false;

        if (shouldScaleUp) {
            if (this._desired >= currentSize) {
                canScaleUp = true;
            }
            else {
                if (!this._notFulfilledTimeUp) {
                    this._notFulfilledTimeUp = Date.now();
                }
                if (Date.now() - this._notFulfilledTimeUp > 60000) {
                    canScaleUp = true;
                    this._notFulfilledTimeUp = null;
                }
            }
        }
        if (shouldScaleDown) {
            if (this._desired <= currentSize) {
                canScaleDown = true;
            }
            else {
                if (!this._notFulfilledTimeDown) {
                    this._notFulfilledTimeDown = Date.now();
                }
                if (Date.now() - this._notFulfilledTimeDown > 60000) {
                    canScaleDown = true;
                    this._notFulfilledTimeDown = null;
                }
            }
        }
        if (canScaleUp) {
            const replicas = this._required - currentSize;
            const scaleTo = this._required;
            this._desired = this._required;
            this._lastScaleUpTime = Date.now();
            this._scaleUp({ replicas, currentSize, scaleTo });
        }
        if (canScaleDown) {
            const replicas = currentSize - this._required;
            const scaleTo = this._required;
            this._desired = this._required;
            this._lastScaleDownTime = Date.now();
            this._scaleDown({ replicas, currentSize, scaleTo });
        }
    }

    get required() {
        return this._required;
    }

    get desired() {
        return this._desired;
    }

    updateRequired(required) {
        this._required = required;
    }

    _shouldScaleUp(currentSize) {
        if (currentSize < this._required
            && (!this._lastScaleDownTime || Date.now() - this._lastScaleDownTime > this._minTimeBetweenScales)) {
            return true;
        }
        return false;
    }

    _shouldScaleDown(currentSize) {
        if (currentSize > this._required
            && (!this._lastScaleUpTime || Date.now() - this._lastScaleUpTime > this._minTimeBetweenScales)) {
            return true;
        }
        return false;
    }
}

module.exports = PendingScale;
