const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { JobResult, JobStatus } = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const DriverStates = require('./DriverStates');

class StateManager extends EventEmitter {
    constructor(option) {
        super();
        const options = option || {};
        this._handleEvent = this._handleEvent.bind(this);
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        this._podName = options.podName;
        this._etcd.discovery.register({ data: this._getDiscovery() });
        this._subscribe();
    }

    close() {
        this._etcd._client.client.close();
    }

    _subscribe() {
        this._etcd.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
        });
        this._etcd.jobState.on('change', (data) => {
            this.emit(`job-${data.state}`, data);
        });
    }

    _getDiscovery(discovery) {
        const data = {
            paused: false,
            driverStatus: DriverStates.READY,
            jobStatus: DriverStates.READY,
            podName: this._podName,
            ...discovery
        };
        return data;
    }

    _updateDiscovery(discovery) {
        const data = this._getDiscovery(discovery);
        return this._etcd.discovery.updateRegisteredData(data);
    }

    _handleEvent(event) {
        this.emit(event.name, event.data);
    }

    async setJobResults(options) {
        let error;
        try {
            let results;
            if (options.data) {
                const data = await Promise.all(options.data.map(async (a) => {
                    if (a.result && a.result.storageInfo) {
                        const result = await storageManager.get(a.result.storageInfo);
                        return { ...a, result };
                    }
                    return a;
                }));
                const storageInfo = await storageManager.hkubeResults.put({ jobId: options.jobId, data });
                results = { storageInfo };
            }
            await this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult({ ...options, data: results }) });
        }
        catch (e) {
            error = e.message;
        }
        return error;
    }

    async setJobStatus(options) {
        const { discovery, ...rest } = options;
        await this._updateDiscovery(discovery);
        return this._etcd.jobStatus.set({ jobId: rest.jobId, data: new JobStatus(rest) });
    }

    getJobStatus(options) {
        return this._etcd.jobStatus.get({ jobId: options.jobId });
    }

    tasksList(options) {
        return this._etcd.tasks.list(options);
    }

    getExecution(options) {
        return this._etcd.runningPipelines.get(options);
    }

    setExecution(options) {
        return this._etcd.runningPipelines.set(options);
    }

    watchTasks(options) {
        return this._etcd.tasks.watch(options);
    }

    unWatchTasks(options) {
        return this._etcd.tasks.unwatch(options);
    }

    deleteTasksList(options) {
        return this._etcd.tasks.delete(options);
    }

    stopJob(options) {
        return this._etcd.jobState.stop(options);
    }

    watchJobState(options) {
        return this._etcd.jobState.watch(options);
    }

    unWatchJobState(options) {
        return this._etcd.jobState.unwatch(options);
    }
}

module.exports = StateManager;
