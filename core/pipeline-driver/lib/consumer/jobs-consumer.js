const EventEmitter = require('events');
const validate = require('djsv');
const { Consumer } = require('@hkube/producer-consumer');
const schema = require('./schema');

class JobConsumer extends EventEmitter {

    constructor() {
        super();
    }

    /**
     * Init the consumer and register for jobs
     * @param {*} options
     */
    init(options) {
        const setting = { setting: { redis: options.redis } };
        const res = validate(schema, setting);
        if (!res.valid) {
            throw new Error(res.error);
        }
        this._consumer = new Consumer(setting);
        this._consumer.register(setting);
        this._consumer.on('job', (job) => {
            this.emit('job-start', job);
        })
    }
}

module.exports = new JobConsumer();
