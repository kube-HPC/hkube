class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._pendingScale = Object.create(null);
    }

    get(nodeName) {
        this._pendingScale[nodeName] = this._pendingScale[nodeName] || { upCount: null, downTo: null };
        return this._pendingScale[nodeName];
    }

    check(nodeName, currentSize) {
        const pendingScale = this.get(nodeName);

        if (pendingScale.upCount && pendingScale.upCount <= currentSize) {
            if (Date.now() - pendingScale.upTime >= this._minTimeWaitForReplicaUp) {
                pendingScale.upCount = null;
                pendingScale.upTime = null;
            }
        }
        if (pendingScale.downTo && pendingScale.downTo >= currentSize) {
            pendingScale.downTo = null;
        }
        return pendingScale;
    }

    updateUp(nodeName, replicas) {
        const pendingScale = this._pendingScale[nodeName];
        pendingScale.upCount = replicas;
        pendingScale.upTime = Date.now();
    }

    updateDown(nodeName, replicas) {
        const pendingScale = this._pendingScale[nodeName];
        pendingScale.downTo = Math.max(0, replicas);
    }
}

module.exports = PendingScale;
