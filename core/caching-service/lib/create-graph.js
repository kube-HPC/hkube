const graphlib = require('graphlib');
const { alg } = require('graphlib')
const { parser, consts } = require('@hkube/parsers');
const { aggregateInput } = require('./input-parser')
const nodeTemplate = (nodeName, algorithmName, input) => ({
    nodeName,
    algorithmName,
    input
})

class NodesMap {
    constructor(_nodes) {
        this._graph = new graphlib.Graph({ directed: true });
        this.nodes = _nodes;
        this._buildGraph(this.nodes);

    }

    _buildGraph(_nodes) {
        const nodes = [];
        _nodes = _nodes || [];
        _nodes.forEach((n) => {
            n.input.forEach((i) => {
                const results = parser.extractNodesFromInput(i);
                results.forEach((r) => {
                    let node = nodes.find(f => f.source === r.nodeName && f.target === n.nodeName);
                    if (!node) {
                        node = { source: r.nodeName, target: n.nodeName, edges: [{ type: r.type }] };
                        nodes.push(node);
                    }
                    else {
                        node.edges.push({ type: r.type });
                    }
                });
            });
            this._graph.setNode(n.nodeName, n);
        });

        nodes.forEach((n) => {
            this._graph.setEdge(n.source, n.target, n.edges);
        });
    }

    findDependentNodes(nodeId) {
        const predecessors = this._graph.predecessors(nodeId);
        const getAllPredecessors = this.getAllPredecessors("A", this._graph)
        const getAllSuccessors = this.getAllSuccessors("A", this._graph)
        console.log("predecessors", predecessors);
        // console.log("postOrder", postOrder);
        console.log("getAllPredecessors", getAllPredecessors);
        console.log("getAllSuccessors", getAllSuccessors);
    }


    getAllPredecessors(nodeId, graph = this._graph, res = []) {
        const predecessors = graph.predecessors(nodeId);
        if (!predecessors) {
            throw new Error(`cant find predecessors for ${nodeId}`)
        }
        if (predecessors.length == 0) {
            return;
        }
        res.push({ id: nodeId, predecessors });
        predecessors.forEach(p => this.getAllPredecessors(p, graph, res))
        return res;
    }

    getAllSuccessors(nodeId, graph = this._graph, res = []) {
        const successors = graph.successors(nodeId);
        if (!successors) {
            throw new Error(`cant find successors for ${nodeId}`)
        }
        if (successors.length == 0) {
            return;
        }
        res.push({ id: nodeId, successors });
        successors.forEach(p => this.getAllSuccessors(p, graph, res))
        return res;
    }

    getDependentNodes(nodeId) {

        const data = [];
        const successors = this.getAllSuccessors(nodeId, this._graph)
        aggregateInput(this.nodes, successors)
        // successesors.forEach(s => {

        // const pred = this._graph.predecessors(s.id);
        // const nodeData = this.nodes.find(n=>n.nodeName==s.id)
        //const input = nodeData.input()
        //})
    }
    // getDependentData(successesors, nodePredaccessor) {
    //     const pred = 
    //     nodePredaccessor.forEach(np => {
    //        if(successesors.filter(s => s.id == np)){

    //        } 
    //     })

    // }
}


module.exports = NodesMap;