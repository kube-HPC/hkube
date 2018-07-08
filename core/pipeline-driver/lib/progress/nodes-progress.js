const async = require('async');
const throttle = require('lodash.throttle');

const levels = {
    silly: 'silly',
    debug: 'debug',
    info: 'info',
    warning: 'warning',
    error: 'error',
    critical: 'critical'
};

class ProgressManager {
    constructor(options) {
        options = options || {};
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
            details: '',
            activeNodes: []
        };
    }

    async _defaultSendProgress() {
        return null;
    }

    silly(data) {
        return this._progress(levels.silly, data);
    }

    debug(data) {
        return this._progress(levels.debug, data);
    }

    info(data) {
        return this._progress(levels.info, data);
    }

    warning(data) {
        return this._progress(levels.warning, data);
    }

    error(data) {
        return this._progress(levels.error, data);
    }

    critical(data) {
        return this._progress(levels.critical, data);
    }

    _progress(level, options) {
        const data = this._calcProgress();
        this._currentProgress = data.progress;
        return this._throttleProgress(level, { ...options, data });
    }

    _queueProgress(level, { jobId, pipeline, data, status, error }) {
        return new Promise((resolve, reject) => {
            this._queue.push({ jobId, pipeline, level, status, error, data }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
}

module.exports = ProgressManager;
