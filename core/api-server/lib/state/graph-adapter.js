const pathLib = require('path');
const { Factory } = require('@hkube/redis-utils');
const PREFIX_NODES_GRAPH_PATH = 'hkube:pipeline:graph';

class GraphAdapter {
    constructor() {
        this._client = null;
    }

    async init(options) {
        this._client = Factory.getClient(options.redis);
    }

    async getGraph(options) {
        const { key, shouldParse } = options;
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, key);
        const graph = await this._get(path);
        const result = shouldParse ? JSON.parse(graph) : graph;
        return result;
    }

    setGraph(options) {
        const { key, data } = options;
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, key);
        return this._set(path, data);
    }

    _get(path) {
        return new Promise((resolve, reject) => {
            this._client.get(path, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    _set(path, data) {
        return new Promise((resolve, reject) => {
            this._client.set(path, JSON.stringify(data), (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve(true);
            });
        });
    }
}

module.exports = new GraphAdapter();
