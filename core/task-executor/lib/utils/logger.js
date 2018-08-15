const logger = require('@hkube/logger').GetLogFromContainer();
const INTERVAL = 10000;
const THRESHOLD = 30000;

class Logger {
    constructor() {
        this._logs = new Map();
        this._interval();
    }

    log(error, component) {
        const message = error.message.substr(0, 100);
        let log = this._logs.get(message);
        if (!log) {
            log = {
                count: 0,
                error: message,
                errorObject: error,
                component,
                timestamp: Date.now()
            };
            this._logs.set(message, log);
            this._log(log);
        }
        log.count += 1;
    }

    _interval() {
        setInterval(() => {
            this._logs.forEach((v, k) => {
                if (Date.now() - v.timestamp > THRESHOLD) {
                    this._log(v);
                    this._logs.delete(k);
                }
            });
        }, INTERVAL);
    }

    _log(log) {
        logger.error(`${log.error}. (${log.count} occurrences)`, { component: log.component }, log.errorObject);
    }
}

module.exports = new Logger();
