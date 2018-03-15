const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateManager extends EventEmitter {
    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._subscribe();
    }

    _subscribe() {
        this._etcd.algorithms.queueMetrics.on('change', (res) => {
            this.emit(`queue-metrics`, res);
        });

        this._etcd.algorithms.templatesStore.on('change', (res) => {
            this.emit(`templates-store`, res);
        });
    }

    getQueueMetrics(options) {
        return this._etcd.algorithms.queueMetrics.list();
    }

    setQueueMetrics(options) {
        return this._etcd.algorithms.queueMetrics.setState(options);
    }

    watchQueueMetrics(options) {
        return this._etcd.algorithms.queueMetrics.watch(options);
    }

    setResourceRequirements(options) {
        return this._etcd.algorithms.resourceRequirements.setState(options);
    }

    getStoreTemplates(options) {
        return this._etcd.algorithms.templatesStore.getState(options);
    }

    setStoreTemplates(options) {
        return this._etcd.algorithms.templatesStore.setState(options);
    }

    watchStoreTemplates(options) {
        return this._etcd.algorithms.templatesStore.watch(options);
    }
}

module.exports = new StateManager();