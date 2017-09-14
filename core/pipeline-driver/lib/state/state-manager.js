const Etcd = require('node-etcd');
const SERVICE_PATH = `/services/pipeline-driver`;
const WORKER_PATH = `/services/pipeline-driver`;

class StateManager {

    constructor() {
        this._etcd = null;
    }

    init(options) {
        this._etcd = new Etcd('http://127.0.0.1:4001');
    }

    setDriverState(options) {
        this._etcd.set(this._generateKey(options.key), JSON.stringify(options.value));
    }

    getDriverState(options) {
        return new Promise((resolve) => {
            this._etcd.get(this._generateKey(options.key), (err, res) => {
                if (err) {
                    return resolve();
                }
                return resolve(res.node.value);
            });
        })
    }

    setWorkerState(options) {
        this._etcd.set(this._generateKey(options.key), JSON.stringify(options.value));
    }

    _generateKey(key) {
        return `${SERVICE_PATH}/${key}`;
    }

    setDriverWatch(options) {
        const watcher = this._etcd.watcher(this._generateKey(options.key));
        //watcher.on('change', this._onKeyChanged);
        watcher.on('set', this._onKeyChanged);
        watcher.on('delete', this._onKeyChanged);
        watcher.on('error', this._onKeyChanged);
    }

    _onKeyChanged(res, head) {

    }
}

module.exports = new StateManager();