const Node = require('./Node');

class NodesMap {

    constructor(options) {
        this._map = new Map();
        options.nodes.forEach(node => {
            if (node.batchInput.length > 0) {
                node.batchInput.forEach((b, i) => {
                    this.addNode(new Node({
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
                this.addNode(new Node({ name: node.nodeName, algorithm: node.algorithmName, inputs: { standard: node.input } }));
            }
        });
    }

    getNode(name) {
        return this._map.get(name);
    }

    addNode(node) {
        this._map.set(node.batchID || node.name, node);
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

    isAllNodesFinished() {
        const values = Array.from(this._map.values());
        return values.every(s => s.state === 'completed');
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