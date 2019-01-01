const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const { EventMessages, Components } = require('../consts');

const component = Components.ETCD;
let log;

class EtcdDiscovery extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
        this.previousTaskIds = [];
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new Etcd();
        await this._etcd.init(options.etcdDiscovery.init);
        const discoveryInfo = {
            algorithmName: options.jobConsumer.job.type,
            podName: options.kubernetes.pod_name,
        };
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering worker discovery for id ${this._etcd.discovery._instanceId}`, { component });

        await this.watchWorkerStates();
        this._etcd.workers.on('change', (res) => {
            log.info(`got worker state change ${JSON.stringify(res)}`, { component });
            this.emit(res.status.command, res);
        });
        this.watch({ jobId: 'hookWatch' });
        this._etcd.jobState.on('change', (res) => {
            log.info(JSON.stringify(res), { component });
            switch (res.state) {
                case 'stop':
                    this.emit('stop', res);
                    break;
                default:
                    this.emit('change', res);
            }
        });
        this._etcd.jobResults.on('change', (result) => {
            // send job-result-completed, job-result-failed or job-result-stopped accordingly
            this.emit(`${EventMessages.JOB_RESULT}-${result.status}`, result);
        });
    }

    watchJobResults(options) {
        return this._etcd.jobResults.watch(options);
    }

    async unWatchJobResults(options) {
        return this._etcd.jobResults.unwatch(options);
    }

    async setState(options) {
        const { data } = options;
        await this._etcd.services.set({
            data,
            postfix: 'state'
        });
    }

    async updateDiscovery(options) {
        if (options.taskId && !this.previousTaskIds.find(taskId => taskId === options.taskId)) {
            this.previousTaskIds.push(options.taskId);
        }
        log.info(`update worker discovery for id ${this._etcd.discovery._instanceId} with data ${JSON.stringify(options)}`, { component });
        await this._etcd.discovery.updateRegisteredData({ ...options, previousTaskIds: this.previousTaskIds });
    }

    async update(options) {
        await this._etcd.tasks.setState(options);
    }

    async watch(options) {
        return this._etcd.jobState.watch(options);
    }

    async watchWorkerStates() {
        return this._etcd.workers.watch({ workerId: this._etcd.discovery._instanceId });
    }

    async unwatchWorkerStates() {
        return this._etcd.workers.unwatch({ workerId: this._etcd.discovery._instanceId });
    }

    async unwatch(options) {
        try {
            log.debug('start unwatch', { component });
            await this._etcd.jobState.unwatch(options);
            log.debug('end unwatch', { component });
        }
        catch (error) {
            log.error(`got error unwatching ${JSON.stringify(options)}. Error: ${JSON.stringify(error)}`, { component }, error);
        }
    }
}

module.exports = new EtcdDiscovery();
