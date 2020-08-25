class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._requiredUp = null;
        this._requiredDown = null;
        this._upTime = null;
    }

    check(currentSize) {
        if (this._requiredUp && this._requiredUp <= currentSize) {
            if (!this._upTime) {
                this._upTime = Date.now();
            }
            if (Date.now() - this._upTime >= this._minTimeWaitForReplicaUp) {
                this._requiredUp = null;
                this._upTime = null;
            }
        }
        if (this._requiredDown && this._requiredDown >= currentSize) {
            this._requiredDown = null;
        }
    }

    updateUp(replicas) {
        this._requiredUp = replicas;
    }

    hasDesiredUp() {
        return this._requiredUp !== null;
    }

    hasDesiredDown() {
        return this._requiredDown !== null;
    }

    updateDown(replicas) {
        this._requiredDown = Math.max(0, replicas);
    }
}

module.exports = PendingScale;
