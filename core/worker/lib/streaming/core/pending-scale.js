class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._timeWait = null;
        this._required = 0;
        this._currentSize = 0;
        this._requiredDown = null;
        this._canScaleUp = true;
        this._canScaleDown = true;
    }

    check(currentSize) {
        this._currentSize = currentSize;
        this._checkRequiredUp(currentSize);
        this._checkRequiredDown(currentSize);
    }

    _checkRequiredUp(currentSize) {
        if (!this._required) {
            this._canScaleUp = true;
        }
        else if (this._required <= currentSize) {
            if (!this._timeWait) {
                this._timeWait = Date.now();
            }
            if (Date.now() - this._timeWait >= this._minTimeWaitForReplicaUp) {
                this._canScaleUp = true;
                this._timeWait = null;
            }
            else {
                this._canScaleUp = false;
            }
        }
        else {
            this._canScaleUp = false;
        }
    }

    _checkRequiredDown(currentSize) {
        if (this._requiredDown === null || this._requiredDown >= currentSize) {
            this._canScaleDown = true;
            this._requiredDown = null;
        }
        else {
            this._canScaleDown = false;
        }
    }

    get required() {
        return this._required;
    }

    updateRequiredUp(replicas) {
        this._required += replicas;
    }

    updateRequiredDown(replicas) {
        this._required -= Math.min(replicas, this._required);
        this._requiredDown = this._currentSize - replicas;
    }

    canScaleUp(count) {
        return count > 0 && this._canScaleUp;
    }

    canScaleDown(count) {
        return count > 0 && this._canScaleDown;
    }
}

module.exports = PendingScale;
