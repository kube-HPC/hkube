class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this.upCount = null;
        this.downCount = null;
        this.upTime = null;
    }

    check(currentSize) {
        if (this.upCount && this.upCount <= currentSize) {
            if (!this.upTime) {
                this.upTime = Date.now();
            }
            if (Date.now() - this.upTime >= this._minTimeWaitForReplicaUp) {
                this.upCount = null;
                this.upTime = null;
            }
        }
        if (this.downCount && this.downCount >= currentSize) {
            this.downCount = null;
        }
    }

    updateUp(replicas) {
        this.upCount = replicas;
    }

    updateDown(replicas) {
        this.downCount = Math.max(0, replicas);
    }
}

module.exports = PendingScale;
