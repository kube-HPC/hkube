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
        const discoveryInfo = {};
        await this._etcd.discovery.register({ data: discoveryInfo });
        log.info(`registering discovery for id ${this._etcd.discovery._instanceId}`, { component });
        if ((options.cacheResults || {}).enabled) {
            this.getAlgorithmTemplate = cacheResults(this.getAlgorithmTemplate.bind(this), 2000);
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

    async getWorkers(options = {}) {
        const serviceName = options.workerServiceName || this._workerServiceName;
        const workers = await this._etcd.discovery.list({ serviceName, limit: 10000 });
        return workers;
    }

    async getAlgorithmRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.algorithms.requirements.list(options);
    }

    async getAlgorithmTemplate() {
        const algorithms = await this._db.algorithms.search({
            hasImage: true,
            sort: { created: 'desc' }
        });
        const templates = algorithms.map((a) => {
            if (a.mem) {
                a.mem = parse.getMemoryInMi(a.mem);
            }
            if (a.reservedMemory) {
                a.mem += parse.getMemoryInMi(a.reservedMemory);
            }

            return a;
        });
        return arrayToMap(templates);
    }

    async getJobsStatus({options = {}, filter} = {}) {
        const jobsStatus = await this._etcd.jobs.status.list(options, filter);
        return jobsStatus;
    }

    async getJob({ jobId, fields = {} }) {
        if (!jobId) throw new Error('jobId is required');
        const job = await this._db.jobs.fetch({ jobId, fields});
        return job;
    }

    async updateJobStatus(updatedJob) {
        const updatedStatusJob = await this._db.jobs.updateStatus(updatedJob);
        const updatedNodesAndStatusJob = await this._db.jobs.updateGraph(updatedStatusJob);
        return updatedNodesAndStatusJob;
    }
}

module.exports = new Etcd();
