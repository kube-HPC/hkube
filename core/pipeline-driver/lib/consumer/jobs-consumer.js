const validate = require('djsv');
const { Consumer } = require('@hkube/producer-consumer');
const schema = require('./schema');
const TaskRunner = require('../tasks/task-runner');
const { tracer } = require('@hkube/metrics');
const stateFactory = require('../state/state-factory');
const DriverStates = require('../state/DriverStates');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').JOBS_CONSUMER;

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }
    /**
     * Init the consumer and register for jobs
     * @param {*} options
     */
    init(option) {
        option = option || {};
        const options = {
            setting: {
                redis: option.redis,
                settings: option.jobs.consumer,
                tracer
            }
        };
        const res = validate(schema, options);
        if (!res.valid) {
            throw new Error(res.error);
        }
        this._options = options;
        this._inactiveTimeoutMs = parseInt(option.timeouts.inactivePaused, 10);
        this._consumer = new Consumer(options);
        this._consumer.register(options);
        this._consumer.on('job', (job) => {
            const taskRunner = new TaskRunner(option);
            taskRunner.on('started', (data) => {
                stateFactory.setState({ ...data, driverStatus: DriverStates.ACTIVE });
            });
            taskRunner.on('completed', (data) => {
                stateFactory.setState({ ...data, driverStatus: DriverStates.READY });
            });
            taskRunner.start(job);
        });

        stateFactory.on('discovery-stopProcessing', () => {
            log.info('got pause event', { component });
            if (!this._consumerPaused) {
                this._pause();
                stateFactory.setState({ driverStatus: DriverStates.PAUSED, paused: true });
                this._handleTimeout();
            }
        });
        stateFactory.on('discovery-startProcessing', () => {
            log.info('got resume event', { component });
            if (this._consumerPaused) {
                this._resume();
                stateFactory.setState({ driverStatus: DriverStates.RESUMED, paused: false });
                this._handleTimeout();
            }
        });
    }

    _handleTimeout() {
        if (this._inactiveTimer) {
            clearTimeout(this._inactiveTimer);
            this._inactiveTimer = null;
        }
        if (stateFactory.getState().driverStatus === DriverStates.READY) {
            log.info(`starting pause timeout for driver, ${this._inactiveTimeoutMs / 1000} seconds.`, { component });
            this._inactiveTimer = setTimeout(() => {
                log.info(`driver is inactive for more than ${this._inactiveTimeoutMs / 1000} seconds.`, { component });
                process.exit(0);
            }, this._inactiveTimeoutMs);
        }
    }

    _pause() {
        this._consumerPaused = true;
        return this._consumer.pause({ type: this._options.job.type });
    }

    _resume() {
        this._consumerPaused = false;
        return this._consumer.resume({ type: this._options.job.type });
    }
}

module.exports = new JobConsumer();
