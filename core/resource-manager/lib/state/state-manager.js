const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateManager extends EventEmitter {
    async init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        await this._subscribe();
    }

    async _subscribe() {
        await this.watchStoreTemplates();
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

    getAlgorithmTemplateStore(options) {
        return this._etcd.algorithms.templatesStore.list(options);
    }

    watchStoreTemplates() {
        return this._etcd.algorithms.templatesStore.watch();
    }

    setAlgorithmsResourceRequirements(resourceResults) {
        return Promise.all(resourceResults.map(a => this._etcd.algorithms.resourceRequirements.set(a)));
    }

    getPipelineDriverQueue(options) {
        return this._etcd.pipelineDrivers.queue.list(options);
    }

    getPipelineDriverTemplateStore(options) {
        return this._etcd.pipelineDrivers.templatesStore.list(options);
    }

    setPipelineDriverRequirements(resourceResults) {
        return Promise.all(resourceResults.map(a => this._etcd.pipelineDrivers.resourceRequirements.set(a)));
    }
}

module.exports = new StateManager();
