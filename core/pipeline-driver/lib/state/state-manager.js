const path = require('path');
const Etcd = require('node-etcd');
const DRIVERS_PATH = `/services/pipeline-drivers`;
const WORKERS_PATH = `/services/workers`;
const JOBS_PATH = `/jobs/jobResults`;
const url = require('url');

class StateManager {

    constructor() {
        this._etcd = null;
    }

    init(options) {
        const uri = url.format(options.etcd);
        this._etcd = new Etcd(uri, { timeout: 10000 });
    }

    setDriverState(options) {
        this._etcd.set(`${DRIVERS_PATH}/${options.jobID}/instance`, JSON.stringify(options.value));
    }

    deleteDriverState(options) {
        this._etcd.delete(`${DRIVERS_PATH}/${options.jobID}/instance`);
    }

    _getDriverState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.jobID}/instance`, (err, res) => {
                if (err) {
                    return resolve();
                }
                return resolve(this._tryParseJSON(res.node.value));
            });
        })
    }

    getWorkersTasks(options) {
        return new Promise((resolve, reject) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.jobID}/jobs/${options.taskID}/info`, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(this._tryParseJSON(res.node.value))
            });
        })
    }

    getTaskState(options) {
        return new Promise((resolve, reject) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.jobID}/jobs/${options.taskID}/info`, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(this._tryParseJSON(res.node.value))
            });
        })
    }

    setTaskState(options) {
        return new Promise((resolve, reject) => {
            this._etcd.set(`${DRIVERS_PATH}/${options.jobID}/jobs/${options.taskID}/info`, JSON.stringify(options.value), (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(this._tryParseJSON(res.node.value))
            });
        })
    }

    _getJobsState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`${DRIVERS_PATH}/${options.jobID}/jobs`, { recursive: true }, (err, res) => {
                if (err) {
                    if (err.errorCode === 100) {
                        return resolve();
                    }
                    return reject(err);
                }
                const jobs = res.node.nodes.map(n => this._tryParseJSON(n.value));
                return resolve(jobs);
            });
        })
    }

    _getWorkersState(options) {
        return new Promise((resolve) => {
            this._etcd.get(`jobs/${options.jobID}/tasks`, { recursive: true }, (err, res) => {
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
            const jobs = await this._getJobsState(options);
            const workers = await this._getWorkersState(options);
            const result = Object.assign({}, driver);
            result.jobs = jobs;
            result.workers = workers;
            return result;
        }
        return null;
    }

    watch(path, callback) {
        const watcher = this._etcd.watcher(path);
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