const Etcd = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();

class StateManager {
    init(options) {
        this._etcd = new Etcd(options.etcd);
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`);
    }

    async getKeys(path) {
        const ret = await this._etcd._client.getByQuery(path, { limit: 10000, sort: 'asc' });
        return ret;
    }

    deleteKey(path) {
        return this._etcd._client.delete(path);
    }

    async getAlgorithmRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.algorithms.requirements.list(options);
    }
}

module.exports = new StateManager();
