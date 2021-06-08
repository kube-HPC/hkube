class StateManager {
    async init(options) {
    }

    async* getData(path) {
        switch (path) {
            case "/pipeline-driver/graph/*":
                yield require('./graph.json');
                break;
            case "/pipeline-driver/nodes-graph/*":
                yield require('./graph-node.json');
                break;
            default:
                yield [];
                break;
        }
    }
    getKeys(path) {
        return { [Symbol.asyncIterator]: () => this.getData(path) }
    }

    deleteKey(key) {
    }
}

module.exports = new StateManager();
