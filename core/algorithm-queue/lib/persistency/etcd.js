const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class EtcdClient extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd(options.etcd);
        await this._watch();
    }

    discoveryRegister(options) {
        return this._etcd.discovery.register(options);
    }

    discoveryUpdate(options) {
        return this._etcd.discovery.updateRegisteredData(options);
    }

    updateQueueData({ name, data, pendingAmount, timestamp }) {
        return this._etcd.algorithms.queue.set({ name, data, pendingAmount, timestamp });
    }

    watchQueueActions({ queueId }) {
        return this._etcd.algorithmQueues.watch({ queueId });
    }

    async unWatchQueueActions({ queueId }) {
        try {
            await this._etcd.algorithmQueues.unwatch({ queueId });
        }
        catch {
            return null;
        }
        return null;
    }

    onQueueAction(func) {
        this._etcd.algorithmQueues.on('change', (response) => {
            func(response);
        });
    }

    // TODO: Move to mongo.tasks
    async _watch() {
        await this._etcd.algorithms.executions.watch();
        this._etcd.algorithms.executions.on('change', (data) => {
            this.emit('exec-change', data);
        });
    }
}

module.exports = new EtcdClient();
