const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class EtcdClient extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd(options.etcd);
        await this._watch();
    }

    async discoveryRegister(options) {
        await this._etcd.discovery.register(options);
    }

    async discoveryUpdate(options) {
        await this._etcd.discovery.updateRegisteredData(options);
    }

    async updateTask({ jobId, taskId, status, error, retries }) {
        await this._etcd.jobs.tasks.update({ jobId, taskId, status, error, retries });
    }

    async updateQueueData({ name, data, pendingAmount, timestamp }) {
        await this._etcd.algorithms.queue.set({ name, data, pendingAmount, timestamp });
    }

    async watchQueueActions({ queueId }) {
        await this._etcd.algorithmQueues.watch({ queueId });

        this._etcd.algorithmQueues.on('change', async (data) => {
            this.emit('queue-action', data);
        });
    }

    onQueueAction(func) {
        this._etcd.algorithmQueues.on('change', (response) => {
            func(response);
        });
    }

    async _watch() {
        await this._etcd.jobs.status.watch();
        await this._etcd.algorithms.executions.watch();
        this._etcd.jobs.status.on('change', async (data) => {
            this.emit('job-change', data);
        });
        this._etcd.algorithms.executions.on('change', (data) => {
            this.emit('exec-change', data);
        });
    }
}

module.exports = new EtcdClient();