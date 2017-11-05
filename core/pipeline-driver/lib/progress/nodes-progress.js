const EventEmitter = require('events');
const States = require('lib/state/States');

class ProgressManager extends EventEmitter {

    constructor(nodesMap) {
        super();
        this._nodes = nodesMap;
    }

    calc(node) {
        const nodes = this._nodes.getllNodes();
        const states = this.groupBy(nodes, 'state');
        const completed = nodes.filter(n => n.state === States.COMPLETED);
        const percent = completed.length / nodes.length * 100;

        let details = `nodes state:`;
        Object.entries(states).forEach(([key, value]) => {
            details += `${value.length} ${key}, `;
        });

        this.emit('progress', { percent, details });
    }

    groupBy(array, prop) {
        return array.reduce(function (groups, item) {
            var val = item[prop];
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
        }, {});
    }
}

module.exports = ProgressManager;