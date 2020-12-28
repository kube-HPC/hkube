const Etcd = require('@hkube/etcd');

class StateManager {
    init(option) {
        const options = option || {};
        this._etcd = new Etcd({
            ...options.etcd,
            serviceName: options.serviceName,
        });
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

module.exports = new StateManager();
