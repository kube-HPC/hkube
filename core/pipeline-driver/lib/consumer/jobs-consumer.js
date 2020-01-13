const logger = require('@hkube/logger');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const commands = require('../consts/commands');
const TaskRunner = require('../tasks/task-runner');
const component = require('../consts/componentNames').JOBS_CONSUMER;
let log;

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }

    /**
     * Init the consumer and register for jobs
     * @param {*} options
     */
    init(opt) {
        log = logger.GetLogFromContainer();
        const option = opt || {};
        const { maxStalledCount, type, prefix } = option.jobs.consumer;
        const options = {
            job: { type },
            setting: {
                redis: option.redis,
                settings: { maxStalledCount },
                tracer,
                prefix
            }
        };
        this._options = options;
        this._consumerPaused = false;
        this._inactiveTimeoutMs = parseInt(option.timeouts.inactivePaused, 10);
        this._consumer = new Consumer(options);
        this._consumer.register(options);
        this._consumer.on('job', (job) => {
            this._taskRunner.start(job);
        });
        this._handleTaskRunner(option);
    }

    _handleTaskRunner(option) {
        this._taskRunner = new TaskRunner(option);
        this._taskRunner.on(commands.stopProcessing, () => {
            this._stopProcessing();
        });
    }

    async _stopProcessing() {
        if (!this._consumerPaused) {
            log.info('got stop command', { component });
            await this._taskRunner.setPaused(true);
            await this._pause();
            this._handleTimeout();
        }
    }

    _handleTimeout() {
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
            await this._consumer.pause({ type: this._options.job.type });
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
            await this._consumer.resume({ type: this._options.job.type });
            log.info('Job consumer resumed', { component });
        }
        catch (err) {
            this._consumerPaused = true;
            log.error(`Failed to resume consumer. Error:${err.message}`, { component });
        }
    }
}

module.exports = new JobConsumer();
