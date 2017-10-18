const Node = require('lib/nodes/node');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');
const deepExtend = require('deep-extend');

class NodesMap {

    constructor(options) {
        this._map = new Map();
        const nodes = options.nodes.map((item) => item.nodeName);
        const duplicates = this._findDuplicates(nodes);

        if (duplicates.length > 0) {
            throw new Error(`found duplicate nodes ${duplicates.join(',')}`);
        }
        options.nodes.forEach(node => {
            if (!Array.isArray(node.input)) {
                throw new Error(`node ${node.nodeName} input must be an array`);
            }
            const batchIndex = inputParser.batchInputIndex(node.input);
            const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
            if (batchIndex > -1 && waitAnyIndex > -1) {
                throw new Error(`node ${node.nodeName} input cannot be batch and waitAny`);
            }
            this.addNode(node.nodeName, new Node({ name: node.nodeName, algorithm: node.algorithmName, input: node.input }));
        });
    }

    _findDuplicates(data) {
        let result = [];
        data.forEach((element, index) => {
            if (data.indexOf(element, index + 1) > -1) {
                if (result.indexOf(element) === -1) {
                    result.push(element);
                }
            }
        });
        return result;
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

    addBatch(batch) {
        const node = this._map.get(batch.name);
        if (node) {
            node.batch.push(batch);
        }
    }

    setNode(name, node) {
        const n = this._map.get(name);
        if (n) {
            deepExtend(n, node);
            this._map.set(name, n);
        }
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

    nodeResults(node) {
        const nodes = this.getNodes(node);
        return nodes.map(n => n.result);
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