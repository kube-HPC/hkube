const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateManager extends EventEmitter {
    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._subscribe();
    }

    _subscribe() {
        this.watchStoreTemplates();
        this._etcd.algorithms.templatesStore.on('change', (res) => {
            this.emit('templates-store', res);
        });
    }

    getAlgorithmQueue() {
        return this._etcd.algorithms.algorithmQueue.list();
    }

    setAlgorithmsResourceRequirements(resourceResults) {
        return Promise.all(resourceResults.map(a => this._etcd.algorithms.resourceRequirements.set(a)));
    }

    getResourceRequirements(options) {
        return this._etcd.algorithms.resourceRequirements.list(options);
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

    watchStoreTemplates(options) {
        return this._etcd.algorithms.templatesStore.watch(options);
    }
}

module.exports = new StateManager();
