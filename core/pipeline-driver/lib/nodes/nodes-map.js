const Node = require('lib/nodes/Node');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');

class NodesMap {

    constructor(options) {
        this._map = new Map();
        this._currentState = States.PENDING;
        options.nodes.forEach(node => {
            if (!Array.isArray(node.input)) {
                throw new Error(`node ${node.nodeName} input must be an array`);
            }
            const index = this._findBatch(node.input);
            if (index > -1) {
                const inputs = inputParser.parseValue(options, node.input[index].substr(1));
                if (!Array.isArray(inputs)) {
                    throw new Error(`node ${node.nodeName} batch input must be an array`);
                }
                inputs.forEach((inp, ind) => {
                    const input = node.input.slice();
                    input[index] = inp;
                    this.addNode(`${node.nodeName}#${ind}`, new Node({
                        name: node.nodeName,
                        batchID: `${node.nodeName}#${ind}`,
                        algorithm: node.algorithmName,
                        input: input
                    }));
                })
            }
            else {
                this.addNode(node.nodeName, new Node({ name: node.nodeName, algorithm: node.algorithmName, input: node.input }));
            }
        });
    }

    _findBatch(input) {
        return input.findIndex(i => typeof i === 'string' && i.charAt(0) === '#')
    }

    getNode(name) {
        return this._map.get(name);
    }

    getNodes(name) {
        const values = Array.from(this._map.values());
        return values.filter(n => n.name === name);
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

    isAllNodesActive() {
        const values = Array.from(this._map.values());
        return values.every(s => s.state !== States.PENDING);
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