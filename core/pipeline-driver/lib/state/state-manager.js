const path = require('path');
const Etcd = require('node-etcd');
const DRIVERS_PATH = `/services/pipeline-drivers`;
const WORKERS_PATH = `/services/workers`;

class StateManager {

    constructor() {
        this._etcd = null;
    }

    init(options) {
        this._etcd = new Etcd('http://127.0.0.1:4001', { timeout: 10000 });
    }

    setDriverState(options) {
        this._etcd.set(`${DRIVERS_PATH}/${options.key}/instance`, JSON.stringify(options.value));
    }

    deleteDriverState(options) {
        this._etcd.delete(`${DRIVERS_PATH}/${options.key}/instance`);
    }

    _getDriverState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.key}`, { recursive: true }, (err, res) => {
                if (err) {
                    if (err.errorCode === 100) {
                        return resolve();
                    }
                    return reject(err);
                }
                return resolve(this._tryParseJSON(res.node.value));
            });
        })
    }

    _getJobsState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.key}/jobs`, { recursive: true }, (err, res) => {
                if (err) {
                    if (err.errorCode === 100) {
                        return resolve();
                    }
                    return reject(err);
                }
                const workers = res.node.nodes.map(n => this._tryParseJSON(n.value));
                return resolve(workers);
            });
        })
    }

    async getState(options) {
        const driver = await this._getDriverState(options);
        if (driver) {
            const workers = await this._getJobsState(options);
            const result = Object.assign({}, driver);
            result.workers = workers;
            return result;
        }
        return null;
    }

    setWorkerState(options) {
        this._etcd.set(`${DRIVERS_PATH}/${options.driverKey}/jobs/${options.workerKey}`, JSON.stringify(options.value), 1000, (err, res) => {
            if (err) {
                return;
            }
        });
    }

    setDriverWatch(options, callback) {
        const watcher = this._etcd.watcher(`${DRIVERS_PATH}/${options.key}/instance`);
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