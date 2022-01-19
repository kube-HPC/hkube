const { taskStatuses } = require('@hkube/consts');

class GraphStore {
    formatGraph(json) {
        const graph = this._formatGraph(json);
        return graph;
    }

    _formatGraph(graph) {
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
        if (node.batch.length === 0) {
            return this._handleSingle(node);
        }
        return this._handleBatch(node);
    }

    _mapTask(task) {
        return {
            nodeName: task.nodeName,
            algorithmName: task.algorithmName,
            status: task.status,
            level: task.level,
            batch: [] // Just for now, to prevent dashboard error
        };
    }

    _handleSingle(n) {
        const node = this._mapTask(n);
        return node;
    }

    _handleBatch(n) {
        const node = {
            ...this._mapTask(n),
            batchInfo: this._batchInfo(n.batch)
        };
        return node;
    }

    _batchInfo(batch) {
        const batchInfo = {
            idle: 0,
            completed: 0,
            errors: 0,
            running: 0,
            total: batch.length
        };
        batch.forEach((b) => {
            if (b.error) {
                batchInfo.errors += 1;
            }
            if (b.status === taskStatuses.SUCCEED || b.status === taskStatuses.FAILED) {
                batchInfo.completed += 1;
            }
            else if (b.status === taskStatuses.CREATING || b.status === taskStatuses.PENDING) {
                batchInfo.idle += 1;
            }
            else {
                batchInfo.running += 1;
            }
        });
        return batchInfo;
    }
}

module.exports = new GraphStore();
