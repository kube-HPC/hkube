const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateFactory extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.jobs.watch({ jobId: 'hookWatch' });
        this._subscribe();
    }

    _subscribe() {
        this._etcd.tasks.on('change', (data) => {
            this.emit('event', { name: `task-${data.status}`, data });
        });
        this._etcd.jobs.on('change', (data) => {
            this.emit('event', { name: `job-${data.state}`, data });
        });
    }

    getClient() {
        return this._etcd;
    }
}

module.exports = new StateFactory();
