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
        this._options = options;
        this._discoveryMethod = options.discoveryMethod || function noop() { };
        await this._etcd.discovery.register({ data: this.getState() });
        await this._etcd.discovery.watch({ instanceId: this._etcd.discovery._instanceId });
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
        this._subscribe();
    }

    _getDiscovery() {
        const discovery = this._discoveryMethod();
        const data = {
            paused: false,
            driverStatus: DriverStates.READY,
            jobStatus: DriverStates.READY,
            podName: this._options.kubernetes.pod_name,
            ...this._state,
            ...discovery
        };
        return data;
    }

    methods(options) {
        this._discoveryMethod = options.discoveryMethod || function noop() { };
    }

    getState() {
        return this._getDiscovery();
    }

    setState(options) {
        const discovery = this._getDiscovery();
        const state = { ...discovery, ...options };
        this._state = state;
        return this._updateDiscovery(state);
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
