const logger = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RUNNER;
const INTERVAL = 10000;
const THRESHOLD = 30000;

class Logger {

    constructor() {
        this._logs = new Map();
        this._interval();
    }

    log(error) {
        let log = this._logs.get(error.message);
        if (!log) {
            log = { count: 0, error, timestamp: Date.now() };
            this._logs.set(error.message, log);
        }
        log.count++;
    }

    _interval() {
        setInterval(() => {
            this._logs.forEach((v, k) => {
                if (Date.now() - v.timestamp > THRESHOLD) {
                    this._log(v);
                    this._logs.delete(k);
                }
            })
        }, INTERVAL);
    }

    _log(log) {
        logger.error(`${log.error.message}. (${log.count} occurrences)`, { component }, log.error);
    }
}

module.exports = new Logger();