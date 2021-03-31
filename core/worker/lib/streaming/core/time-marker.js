/**
 * This class responsible to measure idle time of
 * algorithms before the decision of scale down.
 */
class TimeMarker {
    constructor(time) {
        this._minTime = time;
        this._time = null;
    }

    mark() {
        let result = false;
        if (!this._time) {
            this._time = Date.now();
        }
        const diff = Date.now() - this._time;
        if (diff >= this._minTime) {
            result = true;
        }
        return { result, time: diff / 1000 };
    }

    unMark() {
        this._time = null;
    }
}

module.exports = TimeMarker;
