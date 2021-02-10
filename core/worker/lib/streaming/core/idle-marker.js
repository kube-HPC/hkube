const { ScaleReasonsMessages } = require('./scale-reasons');

/**
 * This class responsible to measure idle time of
 * algorithms before the decision of scale down.
 */
class IdleMarker {
    constructor(options) {
        this._maxTimeIdleBeforeReplicaDown = options.maxTimeIdleBeforeReplicaDown;
        this._idles = Object.create(null);
    }

    checkIdleReason({ reqRate, resRate }) {
        let reason;
        let scale = false;
        if (!reqRate && !resRate) {
            const { result, time } = this._mark();
            if (result) {
                scale = true;
                reason = ScaleReasonsMessages.IDLE_TIME({ time });
            }
        }
        else {
            this._unMark();
        }
        return { scale, reason };
    }

    _mark() {
        let result = false;
        if (!this._idles.time) {
            this._idles.time = Date.now();
        }
        const diff = Date.now() - this._idles.time;
        if (diff >= this._maxTimeIdleBeforeReplicaDown) {
            result = true;
        }
        return { result, time: diff / 1000 };
    }

    _unMark() {
        this._idles.time = null;
    }
}

module.exports = IdleMarker;
