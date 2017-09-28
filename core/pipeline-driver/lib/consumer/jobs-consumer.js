const EventEmitter = require('events');
const validate = require('djsv');
const { Consumer } = require('producer-consumer.rf');
const schema = require('./schema');
const stateManager = require('../state/state-manager');

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
            job.id = 'pipeline-driver-job:1046d36f-41fd-49a1-85c6-144fdf7d2129';
            stateManager.setDriverWatch({ key: job.id }, (res) => {
                if (res.action === 'set' && res.node.value) {
                    const r = JSON.parse(res.node.value);
                    if (r.status === 'stopped') {
                        //this.emit('job-stop', job);
                    }
                }
            });
            this.emit('job-start', job);
        })
    }
}

module.exports = new JobConsumer();