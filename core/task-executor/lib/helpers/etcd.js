const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const utils = require('../utils/utils');
const component = require('../../common/consts/componentNames').ETCD;
const CONTAINERS = require('../../common/consts/containers');
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
    }

    sendCommandToWorker({ workerId, command }) {
        return this._etcd.workers.setState({ workerId, status: { command } });
    }

    sendCommandToDriver({ instanceId, command }) {
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
