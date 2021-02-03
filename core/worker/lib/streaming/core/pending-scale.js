/**
 * This class is responsible for holding the data
 * of required replicas at any moment, and also
 * the logic of scale up/down feasibility
 */
class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._minTimeWaitBeforeScaleUp = options.minTimeWaitBeforeScaleUp;
        this._timeWait = null;
        this._timeWaitForScaleUp = null;
        this._requiredUp = null;
        this._requiredDown = null;
        this._currentSize = 0;
        this._required = 0;
    }

    check(currentSize) {
        this._currentSize = currentSize;
        this._checkRequiredUp(currentSize);
        this._checkRequiredDown(currentSize);
    }

    _checkRequiredUp(currentSize) {
        if (this._requiredUp && this._requiredUp <= currentSize) {
            if (!this._timeWait) {
                this._timeWait = Date.now();
            }
            if (Date.now() - this._timeWait >= this._minTimeWaitForReplicaUp) {
                this._requiredUp = null;
                this._timeWait = null;
                this._timeWaitForScaleUp = null;
            }
        }
    }

    _checkRequiredDown(currentSize) {
        if (this._requiredDown === null || this._requiredDown >= currentSize) {
            this._requiredDown = null;
        }
    }

    get required() {
        return this._required;
    }

    get requiredUp() {
        return this._requiredUp;
    }

    get requiredDown() {
        return this._requiredDown;
    }

    updateRequiredUp(replicas) {
        this._requiredUp = this._currentSize + replicas;
        this._required = this._requiredUp;
    }

    updateRequiredDown(replicas) {
        this._requiredDown = this._currentSize - replicas;
        this._required = this._requiredDown;
    }

    markAsCandidateScaleUp() {
        if (!this._timeWaitForScaleUp) {
            this._timeWaitForScaleUp = Date.now();
            if (this.isMinTimeWaitBeforeScaleUp()) {
                this._timeWaitForScaleUp = null;
            }
        }
    }

    canScaleUp(count) {
        return count > 0 && this._requiredUp === null;
    }

    isMinTimeWaitBeforeScaleUp() {
        return !this._timeWaitForScaleUp || Date.now() - this._timeWaitForScaleUp >= this._minTimeWaitBeforeScaleUp;
    }

    canScaleDown(count) {
        return count > 0 && this._requiredDown === null;
    }
}

module.exports = PendingScale;
