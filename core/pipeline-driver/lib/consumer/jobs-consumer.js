const EventEmitter = require('events');
const validate = require('djsv');
const { Consumer } = require('@hkube/producer-consumer');
const schema = require('./schema');
const Events = require('../consts/Events');
const { tracer } = require('@hkube/metrics');

class JobConsumer extends EventEmitter {

    constructor() {
        super();
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
        this._consumer = new Consumer(options);
        this._consumer.register(options);
        this._consumer.on('job', (job) => {
            this.emit(Events.JOBS.START, job);
        })
    }
}

module.exports = new JobConsumer();
