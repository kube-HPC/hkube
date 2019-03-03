const async = require('async');
const throttle = require('lodash.throttle');
const levels = require('@hkube/logger').Levels;

class ProgressManager {
    constructor(option) {
        const options = option || {};
        this._currentProgress = 0;
        this._calcProgress = options.calcProgress || this._defaultCalcProgress;
        this._sendProgress = options.sendProgress || this._defaultSendProgress;
        this._throttleProgress = throttle(this._queueProgress.bind(this), 1000, { trailing: true, leading: true });

        this._queue = async.queue((task, callback) => {
            this._sendProgress(task).then(response => callback(null, response)).catch(error => callback(error));
        }, 1);
    }

    get currentProgress() {
        return this._currentProgress;
    }

    _defaultCalcProgress() {
        return {
            progress: 0,
            details: ''
        };
    }

    async _defaultSendProgress() {
        return null;
    }

    trace(data) {
        return this._progress(levels.TRACE.name, data);
    }

    silly(data) {
        return this._progress(levels.SILLY.name, data);
    }

    debug(data) {
        return this._progress(levels.DEBUG.name, data);
    }

    info(data) {
        return this._progress(levels.INFO.name, data);
    }

    warning(data) {
        return this._progress(levels.WARN.name, data);
    }

    error(data) {
        return this._progress(levels.ERROR.name, data);
    }

    critical(data) {
        return this._progress(levels.CRITICAL.name, data);
    }

    _progress(level, options) {
        const data = this._calcProgress();
        this._currentProgress = data.progress;
        return this._throttleProgress({ ...options, data, level });
    }

    _queueProgress(options) {
        return new Promise((resolve, reject) => {
            this._queue.push(options, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
}

module.exports = ProgressManager;
