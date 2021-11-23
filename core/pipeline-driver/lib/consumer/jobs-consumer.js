const log = require('@hkube/logger').GetLogFromContainer();
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const stateManager = require('../state/state-manager');
const TaskRunner = require('../tasks/task-runner');
const DriverStates = require('../state/DriverStates');
const component = require('../consts/componentNames').JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._maxJobs = 0;
        this._consumerPaused = false;
        this._drivers = new Map();
    }

    init(options) {
        const { maxStalledCount, concurrency, type, prefix } = options.jobs.consumer;
        const jobOptions = {
            job: { type, concurrency },
            setting: {
                redis: options.redis,
                settings: { maxStalledCount },
                tracer,
                prefix
            }
        };
        this._options = options;
        this._concurrency = concurrency;
        this._jobType = jobOptions.job.type;
        this._discoveryInterval = options.discoveryInterval;
        this._consumer = new Consumer(jobOptions);
        this._consumer.register(jobOptions);
        this._consumer.on('job', async (job) => {
            await this._handleJob(job);
        });
        stateManager.onStopProcessing(async (data) => {
            await this._stopProcessing(data);
        });
        stateManager.onUnScheduledAlgorithms((e) => {
            this._drivers.forEach(d => {
                d.onUnScheduledAlgorithms(e);
            });
        });
        this._intervalActives();
    }

    _intervalActives() {
        setTimeout(async () => {
            try {
                const idle = this._drivers.size === 0;
                const paused = this._consumerPaused;
                const status = this._resolveStatus({ idle, paused });
                const jobs = [];

                if (!idle) {
                    const inActiveJobs = [];
                    this._drivers.forEach(d => {
                        const job = d.getStatus();
                        if (job.active) {
                            jobs.push(job);
                        }
                        else {
                            inActiveJobs.push(job.jobId);
                        }
                    });
                    inActiveJobs.forEach(job => {
                        this._drivers.delete(job);
                    });
                }
                if (jobs.length > this._maxJobs) {
                    this._maxJobs = jobs.length;
                }
                if (jobs.length) {
                    stateManager.checkUnScheduledAlgorithms();
                }
                else {
                    stateManager.unCheckUnScheduledAlgorithms();
                }

                await stateManager.updateDiscovery({ idle, paused, status, jobs, max: this._maxJobs, capacity: this._concurrency });

                if (paused && idle) {
                    this._handleExit();
                }
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._intervalActives();
            }
        }, this._discoveryInterval);
    }

    _resolveStatus({ idle, paused }) {
        if (paused && idle) {
            return DriverStates.EXIT;
        }
        if (!paused && !idle) {
            return DriverStates.ACTIVE;
        }
        if (paused) {
            return DriverStates.PAUSED;
        }
        return DriverStates.READY;
    }

    async _handleJob(job) {
        const taskRunner = new TaskRunner(this._options);
        this._drivers.set(job.data.jobId, taskRunner);
        await taskRunner.start(job);
    }

    async _stopProcessing() {
        if (!this._consumerPaused) {
            log.info('got stop command', { component });
            await this._pause();
        }
    }

    _handleExit() {
        log.info('driver is paused and idle, starting exit process', { component });
        process.exit(0);
    }

    async _pause() {
        try {
            await this._consumer.pause({ type: this._jobType });
            this._consumerPaused = true;
            log.info('Job consumer paused', { component });
        }
        catch (err) {
            this._consumerPaused = false;
            log.error(`Failed to pause consumer. Error:${err.message}`, { component });
        }
    }
}

module.exports = new JobConsumer();
