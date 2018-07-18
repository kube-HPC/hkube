const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const DriverStates = require('./DriverStates');

class StateFactory extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        const discoveryInfo = {
            podName: options.kubernetes.pod_name,
        };

        await this._etcd.discovery.register({ data: discoveryInfo });
        await this._etcd.discovery.watch({ instanceId: this._etcd.discovery._instanceId });
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
        this.state = DriverStates.IDLE;
        this._subscribe();
    }

    get state() {
        return this._state;
    }

    set state(status) {
        this._state = status;
        this._updateDiscovery({ status });
    }

    _updateDiscovery(data) {
        return this._etcd.discovery.updateRegisteredData(data);
    }

    _subscribe() {
        this._etcd.discovery.on('change', (data) => {
            this.emit(`discovery-${data.data.status}`, data);
        });
        this._etcd.tasks.on('change', (data) => {
            this.emit('event', { name: `task-${data.status}`, data });
        });
        this._etcd.jobState.on('change', (data) => {
            this.emit('event', { name: `job-${data.state}`, data });
        });
    }

    getClient() {
        return this._etcd;
    }
}

module.exports = new StateFactory();
