const Node = require('./Node');

class NodesMap {

    constructor(options) {
        this._map = new Map();
    }

    getNode(name) {
        return this._map.get(name);
    }

    addNode(node) {
        this._map.set(node.name, node);
    }

    updateState(name, state, result) {
        const node = this._map.get(name);
        node.state = state;
        node.result = result;
        this._map.set(name, node);
    }

    getState(name) {
        const node = this._map.get(name);
        return node.state;
    }

    isAllNodesFinished(node) {
        const values = Array.from(this._map.values());
        return values.every(s => s.state === 'completed');
    }

    allNodesResults(node) {
        const values = Array.from(this._map.values());
        return values.map(n => {
            return {
                name: n.name,
                algorithm: n.algorithm,
                result: n.result
            }
        });
    }

}

module.exports = NodesMap;