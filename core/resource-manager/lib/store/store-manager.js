const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StoreManager extends EventEmitter {
    async init({ serviceName, etcd }) {
        this._etcd = new Etcd({ ...etcd, serviceName });
        await this._subscribe();
    }

    async _subscribe() {
        await this.watchStoreTemplates();
        this._etcd.algorithms.store.on('change', (res) => {
            this.emit('templates-store-change', res);
        });
        this._etcd.algorithms.store.on('delete', (res) => {
            this.emit('templates-store-change', res);
        });
    }

    getAlgorithmQueue() {
        return this._etcd.algorithms.queue.list();
    }

    getAlgorithmTemplateStore(options) {
        return this._etcd.algorithms.store.list(options);
    }

    watchStoreTemplates() {
        return this._etcd.algorithms.store.watch();
    }

    setAlgorithmsResourceRequirements(options) {
        return this._etcd.algorithms.requirements.set(options);
    }

    getPipelineDriverQueue(options) {
        return this._etcd.pipelineDrivers.queue.list(options);
    }

    getPipelineDriverTemplateStore(options) {
        return this._etcd.pipelineDrivers.store.list(options);
    }

    setPipelineDriverRequirements(resourceResults) {
        return this._etcd.pipelineDrivers.requirements.set(resourceResults);
    }
}

module.exports = new StoreManager();
