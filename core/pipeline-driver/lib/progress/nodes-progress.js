const deepEqual = require('deep-equal');
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
        this._lastState = null;
        this._calc = this._default;
        this._throttledProgress = throttle(this._progress.bind(this), 1000, { trailing: false, leading: true });
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

    async silly(data) {
        return this._throttledProgress(levels.silly, data);
    }

    async debug(data) {
        return this._throttledProgress(levels.debug, data);
    }

    async info(data) {
        return this._progress(levels.info, data);
    }

    async warning(data) {
        return this._progress(levels.warning, data);
    }

    async error(data) {
        return this._progress(levels.error, data);
    }

    async critical(data) {
        return this._progress(levels.critical, data);
    }

    async _progress(level, { jobId, pipeline, status, error }) {
        const { progress, details, activeNodes } = this._calc();
        const data = { level, status, error, progress, details, activeNodes };
        if (!deepEqual(data, this._lastState)) {
            this._lastState = data;
            return stateManager.setJobStatus({ jobId, pipeline, data });
        }
    }
}

module.exports = new ProgressManager();