const GraphBase = require('lib/graph/graph-base');

class ActualGraph extends GraphBase {

    constructor() {
        super();
    }

    removeNode(id) {
        const index = this._nodes.findIndex(v => v.id === id);
        this._nodes.splice(index, 1);
    }
}

module.exports = ActualGraph;