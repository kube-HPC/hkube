const Node = require('lib/nodes/Node');
const States = require('lib/state/States');

class NodesMap {

    constructor(options) {
        this._map = new Map();
        this._currentState = States.PENDING;
        options.nodes.forEach(node => {
            if (Array.isArray(node.batchInput) && node.batchInput.length > 0) {
                node.batchInput.forEach((b, i) => {
                    this.addNode(`${node.nodeName}#${i}`, new Node({
                        name: node.nodeName,
                        batchID: `${node.nodeName}#${i}`,
                        algorithm: node.algorithmName,
                        inputs: {
                            standard: node.input,
                            batch: b,
                        }
                    }));
                })
            }
            else {
                this.addNode(node.nodeName, new Node({ name: node.nodeName, algorithm: node.algorithmName, inputs: { standard: node.input } }));
            }
        });
    }

    getNode(name) {
        return this._map.get(name);
    }

    addNode(name, node) {
        this._map.set(name, node);
    }

    updateNodeState(name, options) {
        const node = this._map.get(name);
        node.state = options.state;
        node.result = options.result;
        node.error = options.error;
        this._map.set(name, node);
    }

    getNodeState(name) {
        const node = this._map.get(name);
        return node.state;
    }

    set currentState(state) {
        this._currentState = state;
    }

    get currentState() {
        return this._currentState;
    }

    isAllNodesInState(state) {
        const values = Array.from(this._map.values());
        return values.every(s => s.state === state);
    }

    allNodesResults(node) {
        const values = Array.from(this._map.values());
        return values.map(n => {
            return {
                name: n.name,
                batchID: n.batchID,
                algorithm: n.algorithm,
                result: n.result
            }
        });
    }

}

module.exports = NodesMap;