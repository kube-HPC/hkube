const deepEqual = require('deep-equal');
const stateManager = require('lib/state/state-manager');

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
        this._progress(levels.silly, data);
    }

    debug(data) {
        this._progress(levels.debug, data);
    }

    info(data) {
        this._progress(levels.info, data);
    }

    warning(data) {
        this._progress(levels.warning, data);
    }

    error(data) {
        this._progress(levels.error, data);
    }

    critical(data) {
        this._progress(levels.critical, data);
    }

    _progress(level, { jobId, pipeline, status, error }) {
        const { progress, details, activeNodes } = this._calc();
        const data = { level, status, error, progress, details, activeNodes };
        if (!deepEqual(data, this._lastState)) {
            this._lastState = data;
            stateManager.setJobStatus({ jobId, pipeline, data });
            //console.log('=========_progress: ' + status + ' ===============');
        }
    }
}

module.exports = new ProgressManager();