const Etcd = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/componentNames').ETCD;

class StateManager {
    constructor(config) {
        const configs = config || {};
        this._etcd = new Etcd({
            ...configs.etcd,
            serviceName: configs.serviceName,
        });
        this._etcd.watcher.on('error', (err, path) => {
            log.error(`etcd watcher for ${path} error: ${err.message}`, { component }, err);
            process.exit(1);
        });
    }

    set(task) {
        return this._etcd.jobs.tasks.set(task);
    }

    get({ jobId, taskId }) {
        return this._etcd.jobs.tasks.get({
            jobId,
            taskId,
        });
    }

    update(task) {
        return this._etcd.jobs.tasks.update(task);
    }

    startWatch() {
        return this._etcd.jobs.results.watch();
    }

    onDone(cb) {
        return this._etcd.jobs.results.on('change', cb);
    }
}

module.exports = StateManager;
