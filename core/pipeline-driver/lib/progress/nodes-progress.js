const States = require('lib/state/States');
const stateManager = require('lib/state/state-manager');
const groupBy = require('lodash.groupby');

const levels = {
    silly: 'silly',
    debug: 'debug',
    info: 'info',
    warning: 'warning',
    error: 'error',
    critical: 'critical'
};

class ProgressManager {

    constructor(nodesMap) {
        this._nodes = nodesMap;
    }

    calc() {
        const nodes = this._nodes.getAllNodes();
        const groupedStates = groupBy(nodes, 'state');
        const completed = groupedStates.completed ? groupedStates.completed.length : 0;
        const percent = (completed / nodes.length * 100).toFixed(2);
        const states = [];

        Object.entries(groupedStates).forEach(([key, value]) => {
            states.push(`${value.length} ${key}`);
        });

        return `${percent}% completed, ${states.join(', ')}`;
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

    _progress(level, { status, error, details }) {
        stateManager.setJobStatus({ level, status, error, details });
    }
}

module.exports = ProgressManager;