const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const component = require('../consts/component-name').STATE_MANAGER;
const { Events } = require('../consts');
const Trigger = require('../triggers/Trigger');
let log;

class StateManager extends EventEmitter {
    async init(options) {
        log = Logger.GetLogFromContainer();
        this._pipelines = Object.create(null);
        this._checkCronsIntervalMs = options.checkCronsIntervalMs;
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        await this._watchJobResults();

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        await this._checkPipelinesInterval();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async _checkPipelinesInterval() {
        setInterval(async () => {
            if (this._active) {
                return;
            }
            try {
                this._active = true;
                this._watchPipelines();
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._active = false;
            }
        }, this._checkCronsIntervalMs);
    }

    async _watchPipelines() {
        const pipelines = await this.searchPipelines();
        pipelines.forEach((p) => {
            this._pipelines[p.name] = p;
            this.emit(Events.CHANGE, new Trigger(p));
        });
        Object.entries(this._pipelines).forEach(([k, v]) => {
            const pipeline = pipelines.find(p => p.name === k);
            if (!pipeline) {
                delete this._pipelines[k];
                this.emit(Events.DELETE, new Trigger(v));
            }
        });
    }

    async searchPipelines({ triggersPipeline, fields, sort, limit } = {}) {
        return this._db.pipelines.search({
            triggersPipeline,
            fields,
            sort,
            limit
        });
    }

    async _watchJobResults() {
        await this._etcd.jobs.results.watch();
        this._etcd.jobs.results.on(Events.CHANGE, async (result) => {
            this.emit(Events.RESULTS, result);
        });
    }
}

module.exports = new StateManager();
