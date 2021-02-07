/**
 * This class is responsible for holding the data
 * of required replicas at any moment, and also
 * the logic of scale up/down feasibility
 */
class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._minTimeWaitBeforeScaleUp = options.minTimeWaitBeforeScaleUp;
        this._minTimeWaitForReplicaDown = options.minTimeWaitForReplicaDown;
        this._minTimeWaitBeforeScaleDown = options.minTimeWaitBeforeScaleDown;
        this._scaleUpTime = null;
        this._scaleDownTime = null;
        this._timeWaitForScaleUp = null;
        this._timeWaitForScaleDown = null;
        this._required = 0;
    }

    check(currentSize) {
        this._checkRequiredUp(currentSize);
        this._checkRequiredDown(currentSize);
    }

    _checkRequiredUp(currentSize) {
        if (this._required <= currentSize) {
            if (!this._timeWaitForScaleUp) {
                this._timeWaitForScaleUp = Date.now();
            }
            if (Date.now() - this._timeWaitForScaleUp >= this._minTimeWaitForReplicaUp) {
                this._timeWaitForScaleUp = null;
            }
        }
        if (Date.now() - this._scaleUpTime >= this._minTimeWaitBeforeScaleUp) {
            this._scaleUpTime = null;
        }
    }

    _checkRequiredDown(currentSize) {
        if (this._required >= currentSize) {
            if (!this._timeWaitForScaleDown) {
                this._timeWaitForScaleDown = Date.now();
            }
            if (Date.now() - this._timeWaitForScaleDown >= this._minTimeWaitForReplicaDown) {
                this._timeWaitForScaleDown = null;
            }
        }
        if (Date.now() - this._scaleDownTime >= this._minTimeWaitBeforeScaleDown) {
            this._scaleDownTime = null;
        }
    }

    get required() {
        return this._required;
    }

    updateRequiredUp(required) {
        this._required = required;
        if (!this._scaleUpTime) {
            this._scaleUpTime = Date.now();
        }
    }

    updateRequiredDown(required) {
        this._required = required;
        if (!this._scaleDownTime) {
            this._scaleDownTime = Date.now();
        }
    }

    canScaleUp(count) {
        return count > 0 && !this._timeWaitForScaleUp && !this._scaleUpTime;
    }

    canScaleDown(count) {
        return count >= 0 && !this._timeWaitForScaleDown && !this._scaleDownTime;
    }
}

module.exports = PendingScale;
