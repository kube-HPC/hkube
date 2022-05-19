const objectPath = require('object-path');
const clone = require('clone');
const flatten = require('flat');

class GraphBuilder {
    _filterData(graph) {
        return {
            edges: graph.edges.map(e => this._formatEdge(e)),
            nodes: graph.nodes.map(n => this._formatNode(n.value))
        };
    }

    _formatEdge(e) {
        const edge = {
            from: e.v,
            to: e.w,
            value: e.value
        };
        return edge;
    }

    _formatNode(node) {
        return this._handleSingle(node);
    }

    _handleSingle(n) {
        const node = {
            nodeName: n.nodeName,
            algorithmName: n.algorithmName
        };
        return node;
    }

    _parseInput(node) {
        if (!node.input) {
            return null;
        }
        const result = clone(node.input);
        const flatObj = flatten(node.input);

        Object.entries(flatObj).forEach(([k, v]) => {
            if (typeof v === 'string' && v.startsWith('$$')) {
                const key = v.substring(2);
                const storage = node.storage[key];
                let input;
                if (Array.isArray(storage)) {
                    input = { type: 'array', size: storage.flatMap(a => a.tasks).length };
                }
                else {
                    input = storage?.storageInfo;
                }
                objectPath.set(result, k, input);
            }
        });
        return result;
    }
}

module.exports = new GraphBuilder();
