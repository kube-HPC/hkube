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
        this._options = options;
        //  await this._etcd.discovery.watch({ instanceId: this._etcd.discovery._instanceId });
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
        this._subscribe();
    }

    _subscribe() {
        // this._etcd.discovery.on('change', (data) => {
        //     this.emit(`discovery-${data.data.status}`, data);
        // });
        // stateFactory.on('discovery-stopProcessing', () => {
        //     log.info('got pause event', { component });
        //     if (!this._consumerPaused) {
        //         this._pause();
        //         stateFactory.setState({ driverStatus: DriverStates.PAUSED, paused: true });
        //         this._handleTimeout();
        //     }
        // });
        // stateFactory.on('discovery-startProcessing', () => {
        //     log.info('got resume event', { component });
        //     if (this._consumerPaused) {
        //         this._resume();
        //         stateFactory.setState({ driverStatus: DriverStates.RESUMED, paused: false });
        //         this._handleTimeout();
        //     }
        // });
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
