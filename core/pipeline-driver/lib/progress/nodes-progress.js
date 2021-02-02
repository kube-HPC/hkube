const async = require('async');
const { median } = require('@hkube/stats');
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
            batch: (...args) => this.calcProgressBatch(...args),
            stream: (...args) => this.calcProgressStream(...args)
        };
        this._calcProgress = this._progressTypes[type];
        this._getGraphNodes = options.getGraphNodes;
        this._getGraphEdges = options.getGraphEdges;
        this._sendProgress = options.sendProgress;
        this._throttleProgress = throttle(this._queueProgress.bind(this), 1000, { trailing: true, leading: true });

        this._queue = async.queue((task, callback) => {
            this._sendProgress(task).then(response => callback(null, response)).catch(error => callback(error));
        }, 1);
    }

    get currentProgress() {
        return this._currentProgress;
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
        return this._calcProgressInner((d) => this._calcProgressBatch(d));
    }

    calcProgressStream() {
        return this._calcProgressInner((d) => this._calcProgressStream(d));
    }

    _calcProgressBatch(options) {
        const { nodes, groupedStates, reduceStates, textStates } = options;
        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const skipped = groupedStates.skipped ? groupedStates.skipped.length : 0;
        const completed = succeed + failed + skipped;
        const progress = parseFloat(((completed / nodes.length) * 100).toFixed(2));
        const states = reduceStates;
        const details = `${progress}% completed, ${textStates}`;
        return { progress, states, details };
    }

    _calcProgressStream(options) {
        const edges = this._getGraphEdges();
        const { reduceStates, textStates } = options;
        const throughput = edges.filter(n => n.value.metrics).map(n => n.value.metrics.throughput);
        const progress = median(throughput);
        const states = reduceStates;
        const details = textStates;
        return { progress, states, details };
    }

    _calcProgressInner(funcCalc) {
        const calc = {
            progress: 0,
            states: {},
            details: ''
        };
        const nodes = this._getGraphNodes();
        if (nodes.length === 0) {
            return calc;
        }
        const groupedStates = groupBy.groupBy(nodes, 'status');
        const reduceStates = groupBy.reduce(groupedStates);
        const textStates = groupBy.text(reduceStates);
        return funcCalc({ nodes, groupedStates, reduceStates, textStates });
    }
}

module.exports = ProgressManager;
