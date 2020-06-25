const { NodesMap } = require('@hkube/dag');

class CreateGraph {
    constructor(nodes) {
        this._graph = new NodesMap({ nodes });
    }

    getAllPredecessors(nodeId, res = []) {
        const predecessors = this._graph._parents(nodeId);
        if (!predecessors) {
            throw new Error(`cant find predecessors for ${nodeId}`);
        }
        if (predecessors.length === 0) {
            return null;
        }
        res.push({ id: nodeId, predecessors });
        predecessors.forEach(p => this.getAllPredecessors(p, res));
        return res;
    }

    getAllSuccessors(nodeId, res = []) {
        const successors = this._graph._childs(nodeId);
        if (!successors) {
            throw new Error(`cant find successors for ${nodeId}`);
        }
        if (successors.length === 0) {
            return null;
        }
        res.push({ id: nodeId, successors });
        successors.forEach(p => this.getAllSuccessors(p, res));
        return res;
    }
}

module.exports = CreateGraph;
