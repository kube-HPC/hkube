const async = require('async');
const logger = require('@hkube/logger');
const throttle = require('lodash.throttle');
const levels = require('@hkube/logger').Levels;
const groupBy = require('../helpers/group-by');
let log;

class ProgressManager {
    constructor(option) {
        if (!log) {
            log = logger.GetLogFromContainer();
        }
        const options = option || {};
        const type = options.type || 'batch';
        this._currentProgress = 0;
        this._progressTypes = {
            batch: (...args) => this.calcProgressBatch(...args)
            // prepare for stream
        };
        this._calcProgress = this._progressTypes[type];
        this._getGraphStats = options.getGraphStats || this._defaultGetGraphStats;
        this._sendProgress = options.sendProgress || this._defaultSendProgress;
        this._throttleProgress = throttle(this._queueProgress.bind(this), 1000, { trailing: true, leading: true });

        this._queue = async.queue((task, callback) => {
            this._sendProgress(task).then(response => callback(null, response)).catch(error => callback(error));
        }, 1);
    }

    get currentProgress() {
        return this._currentProgress;
    }

    _defaultGetGraphStats() {
        return [];
    }

    async _defaultSendProgress() {
        return null;
    }

    trace(data) {
        return this._progress(levels.TRACE.name, data);
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
        return this._throttleProgress({ ...options, data, level }).catch(e => log.warning(`failed to write progress ${e.message}`));
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

    calcProgressBatch() {
        const calc = {
            progress: 0,
            details: '',
            states: {}
        };
        const nodes = this._getGraphStats();
        if (nodes.length === 0) {
            return calc;
        }
        const groupedStates = groupBy.groupBy(nodes, 'status');
        const reduceStates = groupBy.reduce(groupedStates);
        const textStates = groupBy.text(reduceStates);

        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const skipped = groupedStates.skipped ? groupedStates.skipped.length : 0;
        const completed = succeed + failed + skipped;

        calc.progress = parseFloat(((completed / nodes.length) * 100).toFixed(2));
        calc.states = reduceStates;
        calc.details = `${calc.progress}% completed, ${textStates}`;

        return calc;
    }
}

module.exports = ProgressManager;
