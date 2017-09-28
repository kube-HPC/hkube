/**
 * Created by nassi on 02/27/17.
 */

const moment = require('moment');

const LogLevel = {
    TRACE: 'trace',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

class Logger {

    debug(message) {
        this._log(LogLevel.TRACE, message);
    }

    info(message) {
        this._log(LogLevel.INFO, message);
    }

    warn(message) {
        this._log(LogLevel.WARN, message);
    }

    error(message) {
        this._log(LogLevel.ERROR, message);
    }

    _log(type, message) {
        console[type](this._format(type, message));
    }

    _format(level, message) {
        return `${moment().format('MMMM Do YYYY, h:mm:ss a')}  ->  ${level}: (config-it) ${message}`
    }
}

module.exports = new Logger();
