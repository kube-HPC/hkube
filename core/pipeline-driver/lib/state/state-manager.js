const path = require('path');
const Etcd = require('node-etcd');
const DRIVER_PATH = `/services/pipeline-driver`;

class StateManager {

    constructor() {
        this._etcd = null;
    }

    init(options) {
        this._etcd = new Etcd('http://127.0.0.1:4001', { timeout: 10000 });
    }

    setDriverState(options) {
        this._etcd.set(`${DRIVER_PATH}/${options.key}`, JSON.stringify(options.value));
    }

    deleteDriverState(options) {
        this._etcd.delete(`${DRIVER_PATH}/${options.key}`);
    }

    getDriverState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVER_PATH}/${options.key}`, (err, res) => {
                if (err) {
                    return resolve();
                }
                return resolve(res.node.value);
            });
        })
    }

    getWorkersState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVER_PATH}/${options.key}/workers`, { recursive: true }, (err, res) => {
                if (err) {
                    if (err.errorCode === 100) {
                        return resolve();
                    }
                    return reject(err);
                }
                const workers = res.node.nodes.map(n => {
                    return {
                        key: path.parse(n.key).name,
                        value: this._tryParseJSON(n.value)
                    }
                });
                return resolve(workers);
            });
        })
    }

    setWorkerState(options) {
        this._etcd.set(`${DRIVER_PATH}/${options.driverKey}/workers/${options.workerKey}`, JSON.stringify(options.value), 1000, (err, res) => {
            if (err) {
                return;
            }
        });
    }

    setDriverWatch(options, callback) {
        const watcher = this._etcd.watcher(`${DRIVER_PATH}/${options.key}`);
        //watcher.on('change', this._onKeyChanged);
        watcher.on('set', (callback));
        watcher.on('delete', callback);
        watcher.on('error', callback);
    }

    _onKeyChanged(res, head) {

    }

    _tryParseJSON(json) {
        let parsed = json;
        try {
            parsed = JSON.parse(json);
        } catch (e) {
        }
        return parsed
    }
}

module.exports = new StateManager();