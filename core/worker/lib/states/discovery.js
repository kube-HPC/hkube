const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const { EventMessages, Components } = require('../consts');
const { WATCH_STATE } = require('../consumer/consts');

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
        this._etcd = new Etcd(options.etcd);
        this._workerId = this._etcd.discovery._instanceId;
        const discoveryInfo = {
            workerId: this._workerId,
            algorithmName: options.jobConsumer.job.type,
            podName: options.kubernetes.pod_name,
            previousTaskIds: []
        };
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering worker discovery for id ${this._workerId}`, { component });

        await this.watchWorkerStates();
        this._etcd.workers.on('change', (res) => {
            log.info(`got worker state change ${JSON.stringify(res)}`, { component });
            this.emit(res.status.command, res);
        });
        this.watch({ jobId: 'hookWatch' });

        this._etcd.jobs.status.on('change', (res) => {
            log.info(JSON.stringify(res), { component });
            switch (res.status) {
                case WATCH_STATE.STOPPED:
                    this.emit(res.state, res);
                    break;
                default:
                    this.emit('change', res);
            }
        });
        this._etcd.algorithms.executions.on('change', (res) => {
            this.emit(res.state, res);
        });
        this._etcd.jobs.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
        });
        this._etcd.jobs.results.on('change', (result) => {
            // send job-result-completed, job-result-failed or job-result-stopped accordingly
            this.emit(`${EventMessages.JOB_RESULT}-${result.status}`, result);
        });
    }


    async stopAlgorithmExecution(options) {
        return this._etcd.algorithms.executions.stop(options);
    }

    async watchAlgorithmExecutions(options) {
        return this._etcd.algorithms.executions.watch(options);
    }

    async unwatchAlgorithmExecutions(options) {
        try {
            log.debug('start unwatch algorithm executions', { component });
            await this._etcd.algorithms.executions.unwatch(options);
        }
        catch (error) {
            log.error(`got error unwatching ${JSON.stringify(options)}. Error: ${error.message}`, { component }, error);
        }
    }

    watchJobResults(options) {
        return this._etcd.jobs.results.watch(options);
    }

    async unWatchJobResults(options) {
        return this._etcd.jobs.results.unwatch(options);
    }

    async updateDiscovery(options) {
        if (options.taskId && !this.previousTaskIds.find(taskId => taskId === options.taskId)) {
            this.previousTaskIds.push(options.taskId);
        }
        log.info(`update worker discovery for id ${this._workerId} with data ${JSON.stringify(options)}`, { component });
        await this._etcd.discovery.updateRegisteredData({ ...options, workerId: this._workerId, previousTaskIds: this.previousTaskIds });
    }

    async update(options) {
        await this._etcd.jobs.tasks.set(options);
    }

    async watchTasks(options) {
        return this._etcd.jobs.tasks.watch(options);
    }

    async unWatchTasks(options) {
        return this._etcd.jobs.tasks.unwatch(options);
    }

    async watch(options) {
        return this._etcd.jobs.state.watch(options);
    }

    async watchWorkerStates() {
        return this._etcd.workers.watch({ workerId: this._workerId });
    }

    async unwatch(options) {
        try {
            log.debug('start unwatch', { component });
            await this._etcd.jobs.state.unwatch(options);
            log.debug('end unwatch', { component });
        }
        catch (error) {
            log.error(`got error unwatching ${JSON.stringify(options)}. Error: ${error.message}`, { component }, error);
        }
    }
}

module.exports = new EtcdDiscovery();
