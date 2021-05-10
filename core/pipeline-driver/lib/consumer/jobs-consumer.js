const log = require('@hkube/logger').GetLogFromContainer();
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const stateManager = require('../state/state-manager');
const TaskRunner = require('../tasks/task-runner');
const component = require('../consts/componentNames').JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
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
        this._jobType = jobOptions.job.type;
        this._consumerPaused = false;
        this._inactiveTimeoutMs = parseInt(options.timeouts.inactivePaused, 10);
        this._consumer = new Consumer(jobOptions);
        this._consumer.register(jobOptions);
        this._consumer.on('job', async (job) => {
            await this._handleJob(job);
        });
        stateManager.onJobStop(async (d) => {
            const driver = this._drivers.get(d.jobId);
            if (driver) {
                await driver.onStop(d);
                this._drivers.delete(d.jobId);
            }
        });
        stateManager.onJobPause(async (d) => {
            const driver = this._drivers.get(d.jobId);
            if (driver) {
                await driver.onPause(d);
                this._drivers.delete(d.jobId);
            }
        });
        stateManager.onTaskStatus((d) => {
            const driver = this._drivers.get(d.jobId);
            if (driver) {
                driver.handleTaskEvent(d);
            }
        });
        stateManager.onStopProcessing(async (data) => {
            await this._stopProcessing(data);
        });
        stateManager.onUnScheduledAlgorithms((e) => {
            this._drivers.forEach(d => {
                d.onUnScheduledAlgorithms(e);
            });
        });
        stateManager.setDiscoveryCallback(() => {
            const array = [];
            this._drivers.forEach(d => {
                array.push(d.getDiscoveryData());
            });
            return array;
        });
    }

    async _handleJob(job) {
        const taskRunner = new TaskRunner(this._options);
        this._drivers.set(job.data.jobId, taskRunner);
        await taskRunner.start(job);
    }

    async _stopProcessing() {
        if (!this._consumerPaused) {
            log.info('got stop command', { component });
            // TODO: RESOLVE THIS
            // await this._taskRunner.setPaused(true);
            await this._pause();
            this._handleTimeout();
        }
    }

    _handleTimeout() {
        // TODO: THIS CAN SHUT-DOWN ACTIVE DRIVER
        if (this._inactiveTimer) {
            clearTimeout(this._inactiveTimer);
            this._inactiveTimer = null;
        }

        log.info(`starting inactive timeout for driver ${this._formatSec()}`, { component });
        this._inactiveTimer = setTimeout(() => {
            log.info(`driver is inactive for more than ${this._formatSec()}`, { component });
            process.exit(0);
        }, this._inactiveTimeoutMs);
    }

    _formatSec() {
        return `${this._inactiveTimeoutMs / 1000} seconds`;
    }

    async _pause() {
        try {
            this._consumerPaused = true;
            await this._consumer.pause({ type: this._jobType });
            log.info('Job consumer paused', { component });
        }
        catch (err) {
            this._consumerPaused = false;
            log.error(`Failed to pause consumer. Error:${err.message}`, { component });
        }
    }

    async _resume() {
        try {
            this._consumerPaused = false;
            await this._consumer.resume({ type: this._jobType });
            log.info('Job consumer resumed', { component });
        }
        catch (err) {
            this._consumerPaused = true;
            log.error(`Failed to resume consumer. Error:${err.message}`, { component });
        }
    }
}

module.exports = new JobConsumer();
