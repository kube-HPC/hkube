const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const { logWrappers } = require('./tracing');
const utils = require('../utils/utils');
const { components, containers } = require('../consts');
const component = components.ETCD;
const CONTAINERS = containers;
let log;

class Etcd {
    constructor() {
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient(options.etcd);
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        await this._etcd.jobs.state.watch({ jobId: 'hookWatch' });
        this._workerServiceName = options.workerServiceName || CONTAINERS.WORKER;
        this._pipelineDriverServiceName = options.workerServiceName || CONTAINERS.PIPELINE_DRIVER;
        const discoveryInfo = {};
        if (options.healthchecks.logExternalRequests) {
            logWrappers([
                'updateDiscovery',
                'sendCommandToWorker',
                'sendCommandToDriver',
                'getWorkers',
                'getPipelineDrivers',
                'getAlgorithmRequests',
                'getPipelineDriverRequests',
                'getAlgorithmTemplate',
                'getDriversTemplate'
            ], this, log);
        }
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering discovery for id ${this._etcd.discovery._instanceId}`, { component });
    }

    async updateDiscovery(options) {
        log.trace(`update discovery for id ${this._etcd.discovery._instanceId} with data ${JSON.stringify(options)}`, { component });
        await this._etcd.discovery.updateRegisteredData(options);
    }

    sendCommandToWorker({ workerId, command, algorithmName, podName }) {
        log.info(`worker for algorithm ${algorithmName} command: ${command}, pod: ${podName}`, {
            component, command, workerId, podName, algorithmName
        });
        return this._etcd.workers.set({ workerId, status: { command }, timestamp: Date.now() });
    }

    sendCommandToDriver({ driverId, command }) {
        log.info(`driver command: ${command}`, { component, command, driverId });
        return this._etcd.drivers.set({ driverId, status: { command }, timestamp: Date.now() });
    }

    async getWorkers(options = {}) {
        const serviceName = options.workerServiceName || this._workerServiceName;
        const workers = await this._etcd.discovery.list({ serviceName });
        return workers;
    }

    async getPipelineDrivers(options = {}) {
        const serviceName = options.pipelineDriverServiceName || this._pipelineDriverServiceName;
        const drivers = await this._etcd.discovery.list({ serviceName });
        return drivers;
    }

    async getAlgorithmRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.algorithms.requirements.list(options);
    }

    async getPipelineDriverRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.pipelineDrivers.requirements.list(options);
    }

    async getAlgorithmTemplate() {
        const templates = await this._etcd.algorithms.store.list();
        return utils.arrayToMap(templates);
    }

    async getDriversTemplate() {
        const templates = await this._etcd.pipelineDrivers.store.list();
        return utils.arrayToMap(templates);
    }
}

module.exports = new Etcd();
