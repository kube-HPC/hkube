const States = require('lib/state/States');
const stateManager = require('lib/state/state-manager');
const groupBy = require('lodash.groupby');
const Progress = require('lib/progress/Progress');

const levels = {
    silly: 0,
    debug: 1,
    info: 2,
    warning: 3,
    error: 4,
    critical: 5
};

class ProgressManager {

    constructor(nodesMap, verbosityLevel) {
        this._nodes = nodesMap;
        const verbosity = !Object.keys(levels).includes(verbosityLevel) ? 'info' : verbosityLevel;
        this._verbosityLevel = levels[verbosity];
    }

    calc() {
        const nodes = this._nodes.getllNodes();
        const groupedStates = groupBy(nodes, 'state');
        const completed = groupedStates.completed ? groupedStates.completed.length : 0;
        const percent = completed / nodes.length * 100;
        const states = [];

        Object.entries(groupedStates).forEach(([key, value]) => {
            states.push(`${value.length} ${key}`);
        });

        return `${percent}% completed, ${states.join(', ')}`;
    }

    silly(data) {
        if (this._verbosityLevel <= levels.SILLY) {
            this._progress('silly', data);
        }
    }

    debug(data) {
        if (this._verbosityLevel <= levels.DEBUG) {
            this._progress('debug', data);
        }
    }

    info(data) {
        if (this._verbosityLevel <= levels.INFO) {
            this._progress('info', data);
        }
    }

    warning(data) {
        if (this._verbosityLevel <= levels.WARN) {
            this._progress('warning', data);
        }
    }

    error(data) {
        if (this._verbosityLevel <= levels.ERROR) {
            this._progress('error', data);
        }
    }

    critical(data) {
        if (this._verbosityLevel <= levels.CRITICAL) {
            this._progress('critical', data);
        }
    }

    _progress(level, { status, error, details }) {
        stateManager.setJobStatus(new Progress({ level, status, error, details }));
    }
}

module.exports = ProgressManager;