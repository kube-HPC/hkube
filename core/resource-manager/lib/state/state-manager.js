const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateManager extends EventEmitter {
    async init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._subscribe();
    }

    _subscribe() {
        this.watchStoreTemplates();
        this._etcd.algorithms.templatesStore.on('change', (res) => {
            this.emit('templates-store-change', res);
        });
        this._etcd.algorithms.templatesStore.on('delete', (res) => {
            this.emit('templates-store-change', res);
        });
    }

    getAlgorithmQueue() {
        return this._etcd.algorithms.algorithmQueue.list();
    }

    setAlgorithmsResourceRequirements(resourceResults) {
        return Promise.all(resourceResults.map(a => this._etcd.algorithms.resourceRequirements.set(a)));
    }

    getPipelineDriverQueue(options) {
        return this._etcd.pipelineDrivers.queue.list(options);
    }

    setPipelineDriverRequirements(resourceResults) {
        return Promise.all(resourceResults.map(a => this._etcd.pipelineDrivers.resourceRequirements.set(a)));
    }

    getStoreTemplates(options) {
        return this._etcd.algorithms.templatesStore.list(options);
    }

    watchStoreTemplates() {
        return this._etcd.algorithms.templatesStore.watch();
    }
}

module.exports = new StateManager();
