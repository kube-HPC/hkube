const EventEmitter = require('events');
const path = require('path');
const asyncQueue = require('async.queue');
const Etcd = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const { cacheResults } = require('../utils');
const { getDatasourcesInUseFolder } = require('../helpers/pathUtils');
const { EventMessages, Components, jobStatus, workerCommands } = require('../consts');
const component = Components.ETCD;
let log;

class StateAdapter extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        if (this._etcd) {
            this._etcd = null;
            this.removeAllListeners();
        }
        if (options.cacheResults.enabled) {
            this.getExistingAlgorithms = cacheResults(this.getExistingAlgorithms.bind(this), options.cacheResults.updateFrequency);
        }
        log = Logger.GetLogFromContainer();
        this._dataSourcesVolume = getDatasourcesInUseFolder(options);
        this._etcd = new Etcd(options.etcd);
        this._workerId = this._etcd.discovery._instanceId;
        this._discoveryInfo = {
            workerId: this._workerId,
            algorithmName: options.jobConsumer.job.type,
            podName: options.kubernetes.pod_name,
            workerImage: options.workerImage,
            algorithmImage: options.algorithmImage,
            streamingDiscovery: options.streaming.serviceDiscovery.address,
            algorithmVersion: options.algorithmVersion
        };
        this._tasksQueue = asyncQueue((task, callback) => {
            this._db.tasks.update(task).then(r => callback(null, r)).catch(e => callback(e));
        }, 1);
        await this._etcd.discovery.register({ data: this._discoveryInfo });
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        log.info(`registering worker discovery for id ${this._workerId}`, { component });
        await this.watchWorkerStates();

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });

        this._etcd.workers.on('change', (res) => {
            log.info(`got worker state change ${JSON.stringify(res)}`, { component });
            this.emit(res.status.command, res);
        });
        this._etcd.algorithms.executions.on('change', (res) => {
            this.emit(res.status, res);
        });
        this._etcd.streaming.statistics.on('change', (data) => {
            this.emit(`streaming-statistics-${data.nodeName}`, data);
        });
    }

    acquireStreamingLock(key) {
        return this._etcd.streaming.statistics.acquireLock(key);
    }

    releaseStreamingLock(key) {
        return this._etcd.streaming.statistics.releaseLock(key);
    }

    reportStreamingStats(options) {
        return this._etcd.streaming.statistics.set(options);
    }

    watchStreamingStats(options) {
        return this._etcd.streaming.statistics.watch(options);
    }

    unWatchStreamingStats(options) {
        return this._etcd.streaming.statistics.unwatch(options);
    }

    _onJobResult(result) {
        this.emit(`${EventMessages.JOB_RESULT}-${result.status}`, result);
    }

    async getJobPipeline({ jobId }) {
        return this._db.jobs.fetchPipeline({ jobId });
    }

    stopWorker({ workerId }) {
        return this._etcd.workers.set({ workerId, status: { command: workerCommands.scaleDown }, timestamp: Date.now() });
    }

    async stopAlgorithmExecution(options) {
        return this._etcd.algorithms.executions.set({ ...options, status: jobStatus.STOPPED });
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
            log.debug(`got error unwatching ${JSON.stringify(options)}. Error: ${error.message}`, { component }, error);
        }
    }

    /**
     * This method watch for job result changes.
     * In case the watch already has job result, we are emit an event
     * on the next tick in order to simulate the regular watch event.
     */
    async watchJobResults({ jobId }) {
        await this._db.jobs.watchResult({ jobId }, (job) => {
            this._onJobResult(job);
        });
        const result = await this._db.jobs.fetchResult({ jobId });
        if (result) {
            setImmediate(() => {
                this._onJobResult(result);
            });
        }
    }

    async unWatchJobResults({ jobId }) {
        return this._db.jobs.unwatchResult({ jobId });
    }

    async updateDiscovery(options) {
        log.info(`update worker discovery for id ${this._workerId}`, { component });
        await this._etcd.discovery.updateRegisteredData({ ...options, ...this._discoveryInfo });
    }

    createTasks(tasks) {
        return this._db.tasks.createMany(tasks);
    }

    deleteTask(taskId) {
        return this._db.tasks.delete({ taskId });
    }

    updateTask(options) {
        return new Promise((resolve, reject) => {
            this._tasksQueue.push(options, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    async watchTasks({ jobId }) {
        return this._db.tasks.watch({ jobId }, (task) => {
            this.emit(`task-${task.status}`, task);
        });
    }

    async unWatchTasks({ jobId }) {
        return this._db.tasks.unwatch({ jobId });
    }

    async getJobStatus({ jobId }) {
        const status = await this._db.jobs.fetchStatus({ jobId });
        return status;
    }

    async watchJobStatus({ jobId }) {
        await this._db.jobs.watchStatus({ jobId }, (job) => {
            this.emit(job.status, job);
        });
    }

    async unwatchJobStatus({ jobId }) {
        try {
            log.debug('start unwatch', { component });
            await this._db.jobs.unwatchStatus({ jobId });
            log.debug('end unwatch', { component });
        }
        catch (error) {
            log.debug(`got error unwatching ${jobId}. Error: ${error.message}`, { component }, error);
        }
    }

    async watchWorkerStates() {
        return this._etcd.workers.watch({ workerId: this._workerId });
    }

    async deleteWorkerState() {
        return this._etcd.workers.delete({ workerId: this._workerId });
    }

    async createAlgorithmType(options) {
        await this._db.algorithms.update(options);
    }

    async deleteAlgorithmType(options) {
        await this._db.algorithms.delete(options);
    }

    async getExistingAlgorithms() {
        return this._db.algorithms.fetchAll();
    }

    async getDataSource(options) {
        let dsName;
        let subPath;
        let dsFiles;
        const { dataSourceId, snapshotId } = options.dataSource || {};

        if (dataSourceId) {
            const dataSource = await this._db.dataSources.fetch({
                id: dataSourceId,
                isPartial: false,
            });
            dsName = dataSource.name;
            subPath = dataSourceId;
            dsFiles = dataSource.files;
        }
        else if (snapshotId) {
            const snapshot = await this._db.snapshots.fetch(
                { id: snapshotId },
                { allowNotFound: false }
            );
            dsName = snapshot.dataSource.name;
            subPath = snapshotId;
            dsFiles = snapshot.filteredFilesList;
        }
        else {
            throw new Error('unable to find matching data-source');
        }
        dsFiles = dsFiles || [];
        const files = dsFiles.map(f => ({
            ...f,
            path: path.join(this._dataSourcesVolume, dsName, subPath, dsName, 'data', f.path, f.name)
        }));
        const dataSource = {
            name: dsName,
            files
        };
        return dataSource;
    }

    async getQueue(name) {
        return this._etcd.algorithms.queue.get({ name });
    }

    async getDiscovery(filter) {
        return this._etcd.discovery.list({ serviceName: 'worker' }, filter);
    }

    async getUnScheduledAlgorithm(algorithmName) {
        const resources = await this._etcd.discovery.list({ serviceName: 'task-executor' });
        const algorithm = resources?.[0]?.unScheduledAlgorithms?.[algorithmName];
        return algorithm;
    }
}

module.exports = new StateAdapter();
