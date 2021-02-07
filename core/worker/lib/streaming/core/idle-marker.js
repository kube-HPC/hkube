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

    checkIdleReason({ reqRate, resRate, source }) {
        let reason;
        let scale = false;
        if (!reqRate && !resRate) {
            const { result, time } = this._mark({ source });
            if (result) {
                scale = true;
                reason = ScaleReasonsMessages.IDLE_TIME({ time });
            }
        }
        else {
            this._unMark({ source });
        }
        return { scale, reason };
    }

    _mark({ source }) {
        let result = false;
        if (!this._idles[source]) {
            this._idles[source] = { time: Date.now() };
        }
        const diff = Date.now() - this._idles[source].time;
        if (diff >= this._maxTimeIdleBeforeReplicaDown) {
            result = true;
        }
        return { result, time: diff / 1000 };
    }

    _unMark({ source }) {
        if (this._idles[source]) {
            delete this._idles[source];
        }
    }
}

module.exports = IdleMarker;
