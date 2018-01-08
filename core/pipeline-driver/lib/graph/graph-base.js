
class GraphBase {

    constructor() {
        this._nodes = [];
    }

    addNode(node) {
        this._nodes.push(node);
    }

    get list() {
        return this._nodes;
    }

    findByTarget(target) {
        return this._nodes.find(n => n.links.find(l => l.target === target));
    }

    findByEdge(source, target) {
        return this._nodes.find(n => n.links.find(l => l.source === source && l.target === target));
    }

    findByTargetAndIndex(target, index) {
        let node = null;
        if (index) {
            const nd = this._nodes.find(n => n.links.find(l => l.target === target));
            if (nd) {
                const link = nd.links.find(l => l.edges.find(e => e.index === index));
                if (link) {
                    node = nd;
                }
            }
        }
        return node;
    }

    updateBySource(source, result) {
        let count = 0;
        this._nodes.forEach(v => {
            v.links.forEach(l => {
                if (l.source === source) {
                    l.edges.forEach(e => {
                        if (e.type === 'waitNode') {
                            e.node = source;
                            e.completed = true;
                            e.result = result;
                            count++;
                        }
                    })
                }
            })
        })
        return count;
    }
}

module.exports = GraphBase;