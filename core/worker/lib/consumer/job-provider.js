const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const { stateEvents, workerStates, Components } = require('../consts');
const component = Components.JOB_PROVIDER;
let log;

class JobProvider extends EventEmitter {
    constructor(config) {
        super();
        this._consumer = null;
        this._isReady = false;
        this._job = null;
        this._config = config;
    }

    init(consumer) {
        log = Logger.GetLogFromContainer();
        this._consumer = consumer;
        stateManager.on(stateEvents.stateEntered, async ({ state }) => {
            switch (state) {
                case workerStates.ready:
                    this._isReady = true;
                    break;
                case workerStates.bootstrap:
                    this._isReady = false;
                    break;
                default:
                    break;
            }
        });

        this._consumer.on('job', async (job) => {
            log.info(`Job ${job.data.jobId} arrived --> Enqueue`, { component });
            this._job = job;
            this.emit('job-queue', this._job);
        });

        setInterval(() => {
            if (this._isReady && this._job != null) {
                this.emit('job', this._job);
                this._job = null;
            }
        }, this._config.pollingInterval);
    }
}

module.exports = JobProvider;
