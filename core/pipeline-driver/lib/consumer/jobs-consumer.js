const EventEmitter = require('events');
const validate = require('djsv');
const { Consumer } = require('raf-tasq');
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
        const setting = {};
        const res = validate(schema, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }
        this._consumer = new Consumer(setting);
        this._consumer.register(setting);
        this._consumer.on('job', (job) => {
            this.emit('job', job);
        })
    }
}

module.exports = new JobConsumer();