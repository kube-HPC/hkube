const async = require('async');
const throttle = require('lodash.throttle');
const stateManager = require('../state/state-manager');

const levels = {
    silly: 'silly',
    debug: 'debug',
    info: 'info',
    warning: 'warning',
    error: 'error',
    critical: 'critical'
};

class ProgressManager {

    constructor() {
        this._calc = this._default;
        this._throttledProgress = throttle(this._progress.bind(this), 1000, { trailing: false, leading: true });
        this._queue = async.queue((task, callback) => {
            stateManager.setJobStatus(task).then(response => {
                return callback(null, response);
            }).catch(error => {
                return callback(error);
            });
        }, 1);
    }

    calcMethod(method) {
        this._calc = method;
    }

    _default() {
        return {
            progress: 0,
            details: '',
            activeNodes: []
        };
    }

    silly(data) {
        return this._throttledProgress(levels.silly, data);
    }

    debug(data) {
        return this._throttledProgress(levels.debug, data);
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

    _progress(level, { jobId, pipeline, status, error }) {
        return new Promise((resolve, reject) => {
            const data = this._calc();
            this._queue.push({ jobId, pipeline, level, status, error, data }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
}

module.exports = new ProgressManager();