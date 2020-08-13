class PendingScale {
    constructor(options) {
        this._minTimeWaitForReplicaUp = options.minTimeWaitForReplicaUp;
        this._pendingScale = Object.create(null);
    }

    get(nodeName, currentSize) {
        this._pendingScale[nodeName] = this._pendingScale[nodeName] || { upCount: null, downTo: null };
        const pendingScale = this._pendingScale[nodeName];

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
}

module.exports = PendingScale;
