const { ScaleReasonsCodes, ScaleReasonsMessages } = require('./scale-reasons');

/**
 * This class responsible to measure idle time of
 * algorithms before the decision of scale down.
 */
class IdleMarker {
    constructor(options) {
        this._minRatioToScaleDown = options.minRatioToScaleDown;
        this._maxTimeIdleBeforeReplicaDown = options.maxTimeIdleBeforeReplicaDown;
        this._idles = Object.create(null);
    }

    checkDurationsReason({ durationsRatio, source }) {
        let reason;
        let scale = false;
        const code = ScaleReasonsCodes.DUR_RATIO;
        if (durationsRatio <= this._minRatioToScaleDown) {
            const { result, time } = this._mark({ source, code });
            if (result) {
                scale = true;
                reason = ScaleReasonsMessages.DUR_RATIO({ time, durationsRatio: durationsRatio.toFixed(2) });
            }
        }
        else {
            this._unMark({ source, code });
        }
        return { scale, reason };
    }

    checkIdleReason({ reqRate, resRate, source }) {
        let reason;
        let scale = false;
        const code = ScaleReasonsCodes.IDLE_TIME;
        if (!reqRate && !resRate) {
            const { result, time } = this._mark({ source, code });
            if (result) {
                scale = true;
                reason = ScaleReasonsMessages.IDLE_TIME({ time });
            }
        }
        else {
            this._unMark({ source, code });
        }
        return { scale, reason };
    }

    _mark({ source, code }) {
        let result = false;
        if (!this._idles[source]) {
            this._idles[source] = {};
        }
        if (!this._idles[source][code]) {
            this._idles[source][code] = { time: Date.now() };
        }
        const diff = Date.now() - this._idles[source][code].time;
        if (diff >= this._maxTimeIdleBeforeReplicaDown) {
            result = true;
        }
        return { result, time: diff / 1000 };
    }

    _unMark({ source, code }) {
        if (this._idles[source] && this._idles[source][code]) {
            delete this._idles[source][code];
        }
    }
}

module.exports = IdleMarker;
