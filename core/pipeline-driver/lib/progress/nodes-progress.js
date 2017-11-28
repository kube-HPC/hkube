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

    _progress(level, { status, error, progress, details }) {
        stateManager.setJobStatus({ level, status, error, progress, details });
    }
}

module.exports = new ProgressManager();