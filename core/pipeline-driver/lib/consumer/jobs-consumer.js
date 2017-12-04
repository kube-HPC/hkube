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
    init(option) {
        option = option || {};
        const options = {
            setting: {
                redis: option.redis,
                settings: option.jobsSettings
            }
        };
        const res = validate(schema, options);
        if (!res.valid) {
            throw new Error(res.error);
        }
        this._consumer = new Consumer(options);
        this._consumer.register(options);
        this._consumer.on('job', (job) => {
            this.emit('job-start', job);
        })
    }
}

module.exports = new JobConsumer();
