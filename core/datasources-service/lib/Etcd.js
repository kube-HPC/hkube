const Etcd = require('@hkube/etcd');

class StateManager {
    constructor(config) {
        const configs = config || {};
        this._etcd = new Etcd({
            ...configs.etcd,
            serviceName: configs.serviceName,
        });
        // this.set = this.set.bind(this);
        // this.update = this.update.bind(this);
    }

    set({ jobId, taskId, nodeName, status }) {
        return this._etcd.jobs.tasks.set({
            jobId,
            taskId,
            nodeName,
            status,
        });
    }

    update({ jobId, taskId, nodeName, status, result, error }) {
        return this._etcd.jobs.tasks.update({
            jobId,
            taskId,
            nodeName,
            status,
            result,
            error,
        });
    }
}

module.exports = StateManager;
