const pathLib = require('path');
const { Factory } = require('@hkube/redis-utils');
const PREFIX_NODES_GRAPH_PATH = 'hkube:pipeline:graph';

class GraphService {
    async init(options) {
        this._client = Factory.getClient(options.redis);
    }

    async getGraph(jobId) {
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, jobId);
        const json = await this._get(path);
        const graph = JSON.parse(json);
        if (!graph) {
            throw new Error('graph not found');
        }
        return graph;
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
}

module.exports = new GraphService();
