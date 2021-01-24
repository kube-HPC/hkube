const Etcd = require('@hkube/etcd');

class StateManager {
    constructor(config) {
        const configs = config || {};
        this._etcd = new Etcd({
            ...configs.etcd,
            serviceName: configs.serviceName,
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

    /** @param {(job: import('./service/types').DoneJob) => void} cb */
    onDone(cb) {
        return this._etcd.jobs.results.on('change', cb);
    }
}

module.exports = StateManager;
