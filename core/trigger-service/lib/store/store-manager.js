const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { Events } = require('../consts/index');

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        this._watchPipelines();
        this._watchJobResults();
    }

    async _watchPipelines() {
        this._etcd.pipelines.on(Events.CHANGE, p => this.emit(Events.CHANGE, p));
        this._etcd.pipelines.on(Events.DELETE, p => this.emit(Events.DELETE, p));
        await this._etcd.pipelines.watch();
    }

    getPipelines() {
        return this._etcd.pipelines.list();
    }

    async _watchJobResults() {
        await this._etcd.jobResults.watch();
        this._etcd.jobResults.on(Events.CHANGE, async (result) => {
            this.emit(Events.RESULTS, result);
        });
    }
}

module.exports = new StateManager();
