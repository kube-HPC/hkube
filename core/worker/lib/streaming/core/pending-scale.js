/**
 * This class is responsible for holding the data
 * of required replicas at any moment, and also
 * the logic of scale up/down feasibility
 */
class PendingScale {
    constructor(options) {
        this._minTimeWaitBeforeScaleUp = options.scaleUp.minTimeWaitBeforeScaleUp;
        this._minTimeWaitBeforeScaleDown = options.scaleDown.minTimeWaitBeforeScaleDown;
        this._scaleUpTime = null;
        this._scaleDownTime = null;
        this._required = 0;
    }

    check(currentSize) {
        this._checkRequiredUp(currentSize);
        this._checkRequiredDown(currentSize);
    }

    _checkRequiredUp(currentSize) {
        if (this._required <= currentSize) {
            if (Date.now() - this._scaleUpTime >= this._minTimeWaitBeforeScaleUp) {
                this._scaleUpTime = null;
            }
        }
    }

    _checkRequiredDown(currentSize) {
        if (this._required >= currentSize) {
            if (Date.now() - this._scaleDownTime >= this._minTimeWaitBeforeScaleDown) {
                this._scaleDownTime = null;
            }
        }
    }

    get required() {
        return this._required;
    }

    updateRequiredUp(required) {
        this._required = required;
        this._scaleDownTime = null;
        if (!this._scaleUpTime) {
            this._scaleUpTime = Date.now();
        }
    }

    updateRequiredDown(required) {
        this._required = required;
        this._scaleUpTime = null;
        if (!this._scaleDownTime) {
            this._scaleDownTime = Date.now();
        }
    }

    canScaleUp(count) {
        return count > 0 && !this._scaleUpTime;
    }

    canScaleDown(count) {
        return count >= 0 && !this._scaleDownTime;
    }
}

module.exports = PendingScale;
