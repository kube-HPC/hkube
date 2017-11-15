const EventEmitter = require('events');
const States = require('lib/state/States');
const groupBy = require('lodash.groupby');
const Progress = require('lib/progress/Progress');

class ProgressManager extends EventEmitter {

    constructor(nodesMap) {
        super();
        this._nodes = nodesMap;
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
        const details = `nodes state: ${states.join(', ')}`;
        this.emit('progress', new Progress({ percent, details }));
    }
}

module.exports = ProgressManager;