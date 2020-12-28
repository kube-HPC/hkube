const EtcdClient = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const parse = require('@hkube/units-converter');
const { cacheResults, arrayToMap } = require('../utils/utils');
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

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });

        this._workerServiceName = options.workerServiceName || CONTAINERS.WORKER;
        this._pipelineDriverServiceName = options.workerServiceName || CONTAINERS.PIPELINE_DRIVER;
        const discoveryInfo = {};
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering discovery for id ${this._etcd.discovery._instanceId}`, { component });
        if ((options.cacheResults || {}).enabled) {
            this.getAlgorithmTemplate = cacheResults(this.getAlgorithmTemplate.bind(this), 2000);
            this.getDriversTemplate = cacheResults(this.getDriversTemplate.bind(this), 5000);
            this.getPipelineDrivers = cacheResults(this.getPipelineDrivers.bind(this), 1000);
            this.getWorkers = cacheResults(this.getWorkers.bind(this), 1000);
        }
    }

    async updateDiscovery(options) {
        log.trace(`update discovery for id ${this._etcd.discovery._instanceId} with data ${JSON.stringify(options)}`, { component });
        await this._etcd.discovery.updateRegisteredData(options);
    }

    sendCommandToWorker({ workerId, command, algorithmName, podName, message }) {
        log.info(`worker for algorithm ${algorithmName} command: ${command}, pod: ${podName}`, {
            component, command, workerId, podName, algorithmName
        });
        return this._etcd.workers.set({ workerId, status: { command }, message, timestamp: Date.now() });
    }

    sendCommandToDriver({ driverId, command }) {
        log.info(`driver command: ${command}`, { component, command, driverId });
        return this._etcd.drivers.set({ driverId, status: { command }, timestamp: Date.now() });
    }

    async getWorkers(options = {}) {
        const serviceName = options.workerServiceName || this._workerServiceName;
        const workers = await this._etcd.discovery.list({ serviceName, limit: 10000 });
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
        const algorithms = await this._db.algorithms.search({
            hasImage: true,
            sort: { created: 'desc' },
            limit: 100,
        });
        const templates = algorithms
            .filter(a => !a.options || a.options.debug === false)
            .map((a) => {
                if (a.mem) {
                    a.mem = parse.getMemoryInMi(a.mem);
                }
                return a;
            });
        return arrayToMap(templates);
    }

    async getDriversTemplate() {
        const templates = await this._db.pipelineDrivers.fetchAll();
        return arrayToMap(templates);
    }
}

module.exports = new Etcd();
