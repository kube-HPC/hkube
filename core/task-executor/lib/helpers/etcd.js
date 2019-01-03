const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const utils = require('../utils/utils');
const { components, containers } = require('../consts');
const component = components.ETCD;
const CONTAINERS = containers;
let log;

class Etcd extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient();
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        await this._etcd.init(options.etcd);
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
        this._workerServiceName = options.workerServiceName || CONTAINERS.WORKER;
        this._pipelineDriverServiceName = options.workerServiceName || CONTAINERS.PIPELINE_DRIVER;
        const discoveryInfo = {
            
        };
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering discovery for id ${this._etcd.discovery._instanceId}`, { component });
    }

    async updateDiscovery(options) {
        log.debug(`update discovery for id ${this._etcd.discovery._instanceId} with data ${JSON.stringify(options)}`, { component });
        await this._etcd.discovery.updateRegisteredData(options);
    }
    
    sendCommandToWorker({ workerId, command, algorithmName, podName }) {
        log.info(`worker for algorithm ${algorithmName} command: ${command}`, {
            component, command, workerId, podName, algorithmName
        });
        return this._etcd.workers.setState({ workerId, status: { command }, timestamp: Date.now() });
    }

    sendCommandToDriver({ instanceId, command }) {
        log.info(`driver command: ${command}`, { component, command, instanceId });
        return this._etcd.discovery.set({ instanceId, serviceName: this._pipelineDriverServiceName, data: { status: { command } } });
    }

    async getWorkers(options = {}) {
        const workerServiceName = options.workerServiceName || this._workerServiceName;
        const workers = await this._etcd.discovery.get({ serviceName: workerServiceName });
        return workers;
    }

    async getPipelineDrivers(options = {}) {
        const serviceName = options.pipelineDriverServiceName || this._pipelineDriverServiceName;
        const drivers = await this._etcd.discovery.get({ serviceName });
        return drivers;
    }

    async getAlgorithmRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.algorithms.resourceRequirements.list(options);
    }

    async getPipelineDriverRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.pipelineDrivers.resourceRequirements.list(options);
    }

    async getAlgorithmTemplate() {
        const templates = await this._etcd.algorithms.templatesStore.list();
        return utils.arrayToMap(templates);
    }

    async getDriversTemplate() {
        const templates = await this._etcd.pipelineDrivers.templatesStore.list();
        return utils.arrayToMap(templates);
    }
}

module.exports = new Etcd();
