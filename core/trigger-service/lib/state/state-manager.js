const Etcd = require('@hkube/etcd');
const EventEmitter = require('events');
const { prefix } = require('../consts/stored-pipeline-events');

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        this._watchPipelines();
        this._watchJobResults();
    }

    async _watchPipelines() {
        this._etcd.pipelines.on(prefix.CHANGE, p => this.emit(prefix.CHANGE, p));
        this._etcd.pipelines.on(prefix.DELETE, p => this.emit(prefix.DELETE, p));
        await this._etcd.pipelines.watch();
    }

    getPipelines() {
        return this._etcd.pipelines.list();
    }

    async _watchJobResults() {
        await this._etcd.jobResults.watch();
        this._etcd.jobResults.on('result-change', async (result) => {
            const pipeline = await this._etcd.execution.getExecution({ jobId: result.jobId });
            this.emit('result-change', result, pipeline);
        });
    }
}

module.exports = new StateManager();
