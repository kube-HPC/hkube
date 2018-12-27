const validate = require('djsv');
const { Consumer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const schema = require('./schema');
const TaskRunner = require('../tasks/task-runner');

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }

    /**
     * Init the consumer and register for jobs
     * @param {*} options
     */
    init(opt) {
        const option = opt || {};
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
            taskRunner.start(job);
        });
    }
}

module.exports = new JobConsumer();
